import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openReviews } from '../reviews-store.mjs';

test('convite de uso único, validação, moderação e persistência', () => {
  const directory = mkdtempSync(path.join(tmpdir(),'rejane-reviews-'));
  const filename = path.join(directory,'test.sqlite');
  let store = openReviews(filename);
  try {
    const token = store.createInvitation();
    const input = {name:'Aluna de teste',rating:5,message:'O acompanhamento me ajudou a organizar minha rotina.',consent:true};
    assert.equal(store.invitation('invalid'),null);
    assert.throws(() => store.submit('a'.repeat(64),input),{status:410});
    for (const invalid of [{rating:6},{rating:2.5},{consent:false},{message:'curto'},{name:'A'}]) {
      assert.throws(() => store.submit(token,{...input,...invalid}),{status:422});
    }
    assert.ok(store.invitation(token));
    store.submit(token,input);
    assert.equal(store.invitation(token),null);
    assert.throws(() => store.submit(token,input),{status:410});
    assert.equal(store.published().length,0);
    const pending = store.pending();
    assert.equal(pending.length,1);
    assert.equal(store.moderate(pending[0].id,'approved'),1);
    assert.equal(store.published()[0].name,input.name);
    assert.equal(store.moderate(pending[0].id,'approved'),0);
    const second = store.createInvitation();
    store.submit(second,{...input,rating:1});
    assert.equal(store.moderate(store.pending()[0].id,'rejected'),1);
    assert.equal(store.published().length,1);
    store.close();
    store = openReviews(filename);
    assert.equal(store.published().length,1);
    const publishedId = store.published()[0].id;
    assert.equal(store.unpublish(publishedId),1);
    assert.equal(store.published().length,0);
    assert.equal(store.unpublish(publishedId),0);
  } finally { store.close(); rmSync(directory,{recursive:true,force:true}); }
});
