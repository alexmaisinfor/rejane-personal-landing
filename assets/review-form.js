'use strict';
const form = document.querySelector('#review-form');
const status = document.querySelector('#review-form-status');
const token = new URLSearchParams(location.hash.slice(1)).get('convite') || '';
const headers = { Authorization: `Bearer ${token}` };
const photoInput = document.querySelector('#review-photo');
const photoPreview = document.querySelector('#review-photo-preview');
let previewUrl;
photoInput.addEventListener('change', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  photoPreview.hidden = true;
  photoInput.setCustomValidity('');
  const file = photoInput.files[0];
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    photoInput.setCustomValidity('Escolha JPG, PNG ou WebP de até 5 MB.'); photoInput.reportValidity(); return;
  }
  previewUrl = URL.createObjectURL(file); photoPreview.src = previewUrl; photoPreview.hidden = false;
});
function readPhoto(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.readAsDataURL(file);
  });
}
async function validateInvitation() {
  if (!/^[a-f0-9]{64}$/.test(token)) { status.textContent = 'Para avaliar, abra o link individual de convite enviado pela Rejane.'; return; }
  try {
    const response = await fetch('/api/invitation',{headers,cache:'no-store'});
    if (!response.ok) { status.textContent = 'Este convite expirou ou já foi utilizado. Peça um novo link à Rejane.'; return; }
    status.textContent = 'Convite válido. Sua avaliação será publicada após aprovação.';
    form.hidden = false;
  } catch { status.textContent = 'Não foi possível verificar o convite. Confira sua conexão e recarregue a página.'; }
}
form.addEventListener('submit',async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true; status.textContent = 'Enviando sua avaliação…';
  try {
    const data = new FormData(form);
    const photo = photoInput.files[0] ? await readPhoto(photoInput.files[0]) : null;
    const response = await fetch('/api/reviews',{
      method:'POST',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({name:data.get('name'),rating:Number(data.get('rating')),message:data.get('message'),consent:data.get('consent') === 'on',photo}),
    });
    const result = await response.json();
    if (!response.ok) { status.textContent = result.error || 'Não foi possível enviar. Tente novamente.'; if (response.status === 410) form.hidden = true; return; }
    form.hidden = true; status.textContent = result.message;
    history.replaceState(null,'',location.pathname);
  } catch { status.textContent = 'Falha de conexão. Tente novamente; cada convite aceita apenas uma avaliação.'; }
  finally { button.disabled = false; }
});
validateInvitation();
