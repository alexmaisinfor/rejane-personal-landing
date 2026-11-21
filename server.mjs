import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { openReviews } from './reviews-store.mjs';
import { normalizeReviewPhoto } from './review-photo.mjs';
const root = process.cwd();
const store = openReviews(process.env.REVIEWS_DB);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const tokenFrom = req => /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1] || '';
function send(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 7_100_000) { const error = new Error('Conteúdo muito grande.'); error.status=413; throw error; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('Conteúdo inválido.'); error.status=400; throw error; }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/admin/')) {
      if (!store.isAdmin(tokenFrom(req))) return send(res,401,{error:'Acesso administrativo inválido ou expirado.'});
      if (req.method === 'GET' && pathname === '/api/admin/reviews') return send(res,200,{reviews:store.adminReviews()});
      const image = /^\/api\/admin\/reviews\/(\d+)\/photo$/.exec(pathname);
      if (req.method === 'GET' && image) {
        const photo = store.photo(Number(image[1]),true);
        if (!photo) return send(res,404,{error:'Foto não encontrada.'});
        res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'no-store'}); res.end(photo); return;
      }
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) return send(res,403,{error:'Origem inválida.'});
        if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') return send(res,415,{error:'Envie JSON.'});
        if (pathname === '/api/admin/invitations') return send(res,201,{token:store.createInvitation()});
        const action = /^\/api\/admin\/reviews\/(\d+)\/(approve|reject|unpublish|pin|unpin)$/.exec(pathname);
        if (action) {
          const id = Number(action[1]);
          const changed = ['pin','unpin'].includes(action[2]) ? store.pin(id,action[2] === 'pin') : action[2] === 'unpublish' ? store.unpublish(id) : store.moderate(id,action[2] === 'approve' ? 'approved' : 'rejected');
          return send(res,changed ? 200 : 409,{message:changed ? 'Avaliação atualizada.' : 'A avaliação já mudou de situação. Atualize a lista.'});
        }
      }
      return send(res,404,{error:'Recurso não encontrado.'});
    }
    const publicPhoto = /^\/review-photos\/(\d+)\.webp$/.exec(pathname);
    if (publicPhoto && ['GET','HEAD'].includes(req.method)) {
      const photo = store.photo(Number(publicPhoto[1]));
      if (!photo) return send(res,404,{error:'Foto não encontrada.'});
      res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'no-store'}); res.end(req.method === 'HEAD' ? undefined : photo); return;
    }
    if (pathname === '/api/reviews' && req.method === 'GET') return send(res,200,store.publishedPage(new URL(req.url,'http://localhost').searchParams.get('cursor')));
    if (pathname === '/api/invitation' && req.method === 'GET') {
      const valid = Boolean(store.invitation(tokenFrom(req)));
      return send(res,valid ? 200 : 410,{valid});
    }
    if (pathname === '/api/reviews' && req.method === 'POST') {
      if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') return send(res,415,{error:'Envie JSON.'});
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) return send(res,403,{error:'Origem inválida.'});
      if (!store.invitation(tokenFrom(req))) return send(res,410,{error:'Convite inválido, expirado ou já utilizado.'});
      const input = await body(req);
      const photo = await normalizeReviewPhoto(input?.photo);
      store.submit(tokenFrom(req),input,photo);
      return send(res,201,{message:'Avaliação recebida! Ela será revisada antes da publicação.'});
    }
    if (pathname.startsWith('/api/')) return send(res,404,{error:'Recurso não encontrado.'});
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{Allow:'GET, HEAD'}); res.end(); return; }
    const publicPage = ['/','/index.html','/avaliar.html','/aprovacoes.html','/privacidade.html'].includes(pathname);
    if (!publicPage && !pathname.startsWith('/assets/')) { res.writeHead(404); res.end(); return; }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || (!publicPage && !file.startsWith(path.join(root,'assets') + path.sep))) { res.writeHead(403); res.end(); return; }
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.status) return send(res,error.status,{error:error.message});
    if (error.code === 'ENOENT' || error instanceof URIError) { res.writeHead(404); res.end('Página não encontrada'); return; }
    console.error('Erro ao processar requisição:',error.message);
    send(res,500,{error:'Não foi possível concluir agora. Tente novamente.'});
  }
});
server.requestTimeout = 15000;
server.listen(Number(process.env.PORT || 8000),'127.0.0.1',() => console.log(`Landing page: http://localhost:${server.address().port}`));
