import { openReviews } from './reviews-store.mjs';
const store = openReviews();
try {
  const [command, argument] = process.argv.slice(2);
  if (command === 'invite' || command === 'access') {
    const base = new URL(process.env.SITE_URL || 'http://localhost:8000');
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error('SITE_URL inválida.');
    const admin = command === 'access';
    const url = new URL(admin ? '/aprovacoes.html' : '/avaliar.html',base);
    url.hash = admin ? `acesso=${store.createAdminAccess()}` : `convite=${store.createInvitation()}`;
    console.log(`${admin ? 'Acesso administrativo privado válido por 30 dias' : 'Convite válido por 7 dias e para um único envio'}:\n${url.href}`);
  } else if (command === 'revoke-access') {
    store.revokeAdminAccess(); console.log('Acessos administrativos revogados. Gere um novo com access.');
  } else if (command === 'pending') {
    const reviews = store.pending();
    console.log(reviews.length ? JSON.stringify(reviews,null,2) : 'Nenhuma avaliação pendente.');
  } else if (command === 'unpublish') {
    if (!store.unpublish(Number(argument))) throw new Error('Avaliação publicada não encontrada.');
    console.log('Avaliação retirada do site.');
  } else if (['approve','reject'].includes(command)) {
    if (!store.moderate(Number(argument),command === 'approve' ? 'approved' : 'rejected')) throw new Error('Avaliação pendente não encontrada.');
    console.log(command === 'approve' ? 'Avaliação aprovada e publicada.' : 'Avaliação rejeitada.');
  } else throw new Error('Uso: node reviews-admin.mjs access | invite | pending | approve ID | reject ID | unpublish ID');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { store.close(); }
