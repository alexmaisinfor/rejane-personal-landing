import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openReviews } from '../reviews-store.mjs';

test('paginação estável, fixação limitada e limpeza ao retirar publicação', () => {
  const directory = mkdtempSync(path.join(tmpdir(),'rejane-pins-'));
  const store = openReviews(path.join(directory,'test.sqlite'));
  try {
    const ids = [];
    for (let index=0;index<8;index++) {
      store.submit(store.createInvitation(),{name:`Aluno ${index}`,rating:5,message:'Depoimento de teste para verificar ordenação e paginação.',consent:true});
      const id = store.pending()[0].id;
      if (index === 7) {
        assert.throws(() => store.pin(id,true),{status:409});
        continue;
      }
      store.moderate(id,'approved'); ids.push(id);
    }
    for (const id of ids.slice(0,3)) assert.equal(store.pin(id,true),1);
    assert.equal(store.pin(ids[0],true),1);
    assert.throws(() => store.pin(ids[3],true),{status:409});
    const first = store.publishedPage();
    assert.equal(first.reviews.length,3);
    assert.ok(first.reviews.every(review => review.pinned === 1));
    assert.deepEqual(new Set(first.reviews.map(review => review.id)),new Set(ids.slice(0,3)));
    const all = [...first.reviews];
    let cursor = first.nextCursor;
    while(cursor) {
      const page = store.publishedPage(cursor);
      assert.ok(page.reviews.length <= 3);
      all.push(...page.reviews); cursor=page.nextCursor;
    }
    assert.equal(all.length,7);
    assert.equal(new Set(all.map(review => review.id)).size,7);
    assert.deepEqual(all.slice(3).map(review => review.id),ids.slice(3).reverse());
    assert.throws(() => store.publishedPage('invalid'),{status:400});
    store.pin(ids[0],false);
    store.pin(ids[3],true);
    store.unpublish(ids[3]);
    assert.equal(store.adminReviews().find(review => review.id === ids[3]).pinned,0);
    assert.equal(store.pin(ids[4],true),1);
    assert.throws(() => store.pin(ids[3],true),{status:409});
  } finally { store.close(); rmSync(directory,{recursive:true,force:true}); }
});
