import {buildContactUrl,normalizePhone,validateSchedules} from './assets/contact-utils.mjs';

export function validateAppointment(input) {
  const invalid = message => { const error = new Error(message); error.status=422; throw error; };
  if (!input || typeof input !== 'object' || typeof input.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId)) invalid('Solicitação inválida. Feche e abra o formulário novamente.');
  if (typeof input.name !== 'string' || typeof input.phone !== 'string' || typeof input.observation !== 'string' || input.consent !== true || typeof input.demoLesson !== 'boolean') invalid('Confira os campos e a autorização para contato.');
  let plan = null;
  if (input.plan !== null) {
    const selected = input.plan;
    const count = /^Presencial ([1-5])x$/.exec(selected?.name || '')?.[1];
    if (!selected || (selected.name !== 'Online' && !count)) invalid('Plano inválido.');
    const online = selected.name === 'Online';
    const price = online ? 250 : Number(count)*800;
    if (selected.price !== price || selected.online !== online) invalid('O plano foi atualizado. Recarregue a página antes de continuar.');
    plan = {name:selected.name,price,online,frequency:online ? 'Consultoria online' : `${count} ${count === '1' ? 'dia' : 'dias'} por semana com acompanhamento.`};
  }
  let schedules;
  try { schedules = validateSchedules(plan,input.schedules); } catch (error) { invalid(error.message); }
  const data = {
    name:input.name.trim(),phone:normalizePhone(input.phone),observation:input.observation.trim(),
    consent:true,plan,demoLesson:Boolean(plan?.online && input.demoLesson),
    schedules:schedules.map(days=>days.map(({day,time})=>({day,time}))),
  };
  try { buildContactUrl(data); } catch (error) { invalid(error.message); }
  return {requestId:input.requestId,data};
}
