'use strict';
const access = new URLSearchParams(location.hash.slice(1)).get('acesso') || '';
const adminStatus = document.querySelector('#admin-status');
const content = document.querySelector('#admin-content');
const list = document.querySelector('#admin-reviews');
const filter = document.querySelector('#admin-filter');
const objectUrls = [];
let reviews = [];
async function api(url,method = 'GET') {
  const response = await fetch(url,{method,headers:{Authorization:`Bearer ${access}`,...(method === 'POST' ? {'Content-Type':'application/json'} : {})},cache:'no-store'});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.message || 'Não foi possível concluir.');
  return data;
}
function renderReviews() {
  objectUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
  list.replaceChildren();
  const selected = reviews.filter(review => review.status === filter.value);
  if (!selected.length) { const empty = document.createElement('p'); empty.textContent = 'Nenhuma avaliação nesta categoria.'; list.append(empty); }
  selected.forEach(review => {
    const card = document.createElement('article'); card.className = 'card admin-review';
    const title = document.createElement('h2'); title.textContent = review.name;
    const rating = document.createElement('p'); rating.className = 'stars'; rating.textContent = `${review.rating} / 5 estrelas`;
    const quote = document.createElement('blockquote'); quote.textContent = review.message;
    card.append(title,rating,quote);
    if (review.pinned) { const badge = document.createElement('span'); badge.className = 'review-pin-badge'; badge.textContent = 'Fixado'; card.prepend(badge); }
    if (review.has_photo) {
      const image = document.createElement('img'); image.className = 'admin-photo'; image.alt = `Foto enviada por ${review.name}`;
      card.append(image);
      fetch(`/api/admin/reviews/${review.id}/photo`,{headers:{Authorization:`Bearer ${access}`},cache:'no-store'})
        .then(response => { if (!response.ok) throw new Error('Foto indisponível'); return response.blob(); })
        .then(blob => { if (!card.isConnected) return; const url = URL.createObjectURL(blob); objectUrls.push(url); image.src = url; })
        .catch(() => { image.remove(); });
    }
    const actions = document.createElement('div'); actions.className = 'admin-toolbar';
    const choices = review.status === 'pending' ? [['approve','Aprovar e publicar'],['reject','Rejeitar']] : review.status === 'approved' ? [[review.pinned ? 'unpin' : 'pin',review.pinned ? 'Desafixar' : 'Fixar'],['unpublish','Retirar do site']] : [];
    choices.forEach(([action,label]) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button' + (action === 'approve' ? '' : ' secondary'); button.textContent = label;
      if (action === 'pin' && reviews.filter(item => item.pinned).length >= 3) { button.disabled = true; button.title = 'Limite de três fixadas. Desafixe uma para liberar espaço.'; }
      button.addEventListener('click',async () => {
        actions.querySelectorAll('button').forEach(item => { item.disabled = true; });
        try { await api(`/api/admin/reviews/${review.id}/${action}`,'POST'); await loadReviews(); adminStatus.textContent = 'Avaliação atualizada.'; }
        catch (error) { adminStatus.textContent = error.message; actions.querySelectorAll('button').forEach(item => { item.disabled = false; }); }
      });
      actions.append(button);
    });
    card.append(actions); list.append(card);
  });
}
async function loadReviews() {
  try {
    const data = await api('/api/admin/reviews'); reviews = data.reviews;
    content.hidden = false; adminStatus.textContent = `${reviews.filter(review => review.status === 'pending').length} avaliações aguardando aprovação. ${reviews.filter(review => review.pinned).length} de 3 fixadas.`;
    renderReviews();
  } catch (error) { adminStatus.textContent = error.message; content.hidden = true; }
}
filter.addEventListener('change',renderReviews);
document.querySelector('#refresh-reviews').addEventListener('click',loadReviews);
document.querySelector('#create-invitation').addEventListener('click',async event => {
  const button = event.currentTarget; button.disabled = true;
  try {
    const {token} = await api('/api/admin/invitations','POST');
    const url = new URL('/avaliar.html',location.origin); url.hash = `convite=${token}`;
    document.querySelector('#invitation-link').value = url.href;
    document.querySelector('#invitation-result').hidden = false;
    adminStatus.textContent = 'Convite criado. Copie e envie somente ao aluno convidado.';
  } catch (error) { adminStatus.textContent = error.message; }
  finally { button.disabled = false; }
});
document.querySelector('#copy-invitation').addEventListener('click',async () => {
  const input = document.querySelector('#invitation-link');
  try { await navigator.clipboard.writeText(input.value); adminStatus.textContent = 'Convite copiado.'; }
  catch { input.select(); adminStatus.textContent = 'Selecione e copie o link com Ctrl+C.'; }
});
const visitsList = document.querySelector('#visits-list');
const visitsStatus = document.querySelector('#visits-status');
const moreVisits = document.querySelector('#more-visits');
const refreshVisits = document.querySelector('#refresh-visits');
const visitDate = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Sao_Paulo'});
let nextVisitOffset = null;
let visitsLoading = false;
async function loadVisits(append = false) {
  if (visitsLoading) return;
  visitsLoading = true; moreVisits.disabled = true; refreshVisits.disabled = true;
  try {
    const data = await api('/api/admin/visits?offset='+(append ? nextVisitOffset : 0));
    if (!append) visitsList.replaceChildren();
    data.visits.forEach(visit => { const item = document.createElement('li'); const time = document.createElement('time'); time.dateTime = new Date(visit.accessed_at).toISOString(); time.textContent = visitDate.format(visit.accessed_at); item.append(time); visitsList.append(item); });
    nextVisitOffset = data.nextOffset; moreVisits.hidden = nextVisitOffset === null;
    document.querySelector('#visits-total').textContent = `${data.total} acessos registrados`;
    visitsStatus.textContent = data.total ? '' : 'Nenhum acesso registrado ainda.';
  } catch (error) { visitsStatus.textContent = error.message; }
  finally { visitsLoading = false; moreVisits.disabled = false; refreshVisits.disabled = false; }
}
refreshVisits.addEventListener('click',() => loadVisits());
moreVisits.addEventListener('click',() => loadVisits(true));
const appointmentsList = document.querySelector('#appointments-list');
const appointmentsStatus = document.querySelector('#appointments-status');
const moreAppointments = document.querySelector('#more-appointments');
const refreshAppointments = document.querySelector('#refresh-appointments');
let nextAppointmentOffset = null;
let appointmentsLoading = false;
async function loadAppointments(append = false) {
  if (appointmentsLoading) return;
  appointmentsLoading = true; moreAppointments.disabled = true; refreshAppointments.disabled = true;
  try {
    const data = await api('/api/admin/appointments?offset='+(append ? nextAppointmentOffset : 0));
    if (!append) appointmentsList.replaceChildren();
    const days = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira'];
    data.appointments.forEach(item => {
      const card = document.createElement('article'); card.className = 'card admin-review';
      const heading = document.createElement('h3'); heading.textContent = item.name;
      const date = document.createElement('p'); date.textContent = `Recebida em ${visitDate.format(item.created_at)} (Brasília)`;
      const phone = document.createElement('a'); phone.href = 'https://wa.me/55'+item.phone; phone.target = '_blank'; phone.rel = 'noopener noreferrer'; phone.textContent = `WhatsApp: ${item.phone}`;
      const plan = document.createElement('p'); plan.textContent = item.plan ? `${item.plan.name} — ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(item.plan.price)}/mês` : 'Atendimento geral';
      card.append(heading,date,phone,plan);
      if (item.demoLesson) { const demo = document.createElement('p'); demo.textContent = 'Interesse no adicional: aula demonstrativa (+ R$ 200).'; card.append(demo); }
      item.schedules.forEach((agenda,index) => {
        const title = document.createElement('h4'); title.textContent = `${index+1}ª opção de agenda`;
        const list = document.createElement('ul');
        agenda.forEach(day => { const li = document.createElement('li'); li.textContent = `${days[day.day]}: ${day.time}`; list.append(li); });
        card.append(title,list);
      });
      const note = document.createElement('p'); note.className = 'appointment-note'; note.textContent = `Observação: ${item.observation || 'Não informada.'}`;
      const consent = document.createElement('p'); consent.textContent = 'Autorização para contato registrada no envio.';
      card.append(note,consent); appointmentsList.append(card);
    });
    nextAppointmentOffset = data.nextOffset; moreAppointments.hidden = nextAppointmentOffset === null;
    appointmentsStatus.textContent = appointmentsList.children.length ? `${appointmentsList.children.length} solicitações exibidas.` : 'Nenhuma solicitação registrada ainda.';
  } catch (error) { appointmentsStatus.textContent = error.message; }
  finally { appointmentsLoading = false; moreAppointments.disabled = false; refreshAppointments.disabled = false; }
}
refreshAppointments.addEventListener('click',() => loadAppointments());
moreAppointments.addEventListener('click',() => loadAppointments(true));
if (/^[a-f0-9]{64}$/.test(access)) { loadReviews(); loadVisits(); loadAppointments(); }
else adminStatus.textContent = 'Abra o link privado de administração fornecido pela Rejane.';
