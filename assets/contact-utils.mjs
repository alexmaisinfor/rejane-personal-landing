export function normalizePhone(value) {
  let digits = String(value).replace(/\D/g,'');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  return digits;
}
export function validPhone(value) {
  return /^[1-9]{2}(?:[2-9]\d{7}|9\d{8})$/.test(normalizePhone(value));
}
export function formatPhone(value) {
  const digits = normalizePhone(value);
  if (!digits) return '';
  if (digits.length <= 2) return '(' + digits;
  const local = digits.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return `(${digits.slice(0,2)}) ${local.slice(0,split)}${local.length > split ? '-' + local.slice(split) : ''}`;
}
export function formatPlanPrice(price) {
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(price);
}
export const WEEK_DAYS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];
export function planDayCount(plan) {
  return plan && !plan.online ? Number(/^Presencial ([1-5])x$/.exec(plan.name)?.[1] || 0) : 0;
}
export function validateSchedules(plan,schedules) {
  const count = planDayCount(plan);
  if (!plan || plan.online) return [];
  if (!count) throw new Error('Não foi possível identificar a frequência do plano.');
  if (!Array.isArray(schedules) || schedules.length < 1 || schedules.length > 2) throw new Error('Preencha a 1ª opção de agenda.');
  for (const [index,days] of schedules.entries()) {
    if (!Array.isArray(days) || days.length !== count) throw new Error(`A ${index+1}ª opção deve conter exatamente ${count} ${count === 1 ? 'dia' : 'dias'}.`);
    if (days.some(item => !item || !Number.isInteger(item.day) || item.day < 0 || item.day > 6 || typeof item.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))) throw new Error(`Preencha os dias e horários da ${index+1}ª opção de agenda.`);
    if (new Set(days.map(item => item.day)).size !== count) throw new Error(`Não repita dias dentro da ${index+1}ª opção.`);
  }
  const signature = days => days.map(item => `${item.day}:${item.time}`).sort().join('|');
  if (schedules.length === 2 && signature(schedules[0]) === signature(schedules[1])) throw new Error('A 2ª opção deve ter ao menos um dia ou horário diferente da primeira.');
  return schedules;
}
export function buildContactUrl({name,phone,observation,consent,plan = null,demoLesson = false,schedules = []}) {
  const cleanName = String(name || '').trim();
  const note = String(observation || '').trim();
  if (cleanName.length < 2 || cleanName.length > 80 || /[\u0000-\u001f]/.test(cleanName) || !validPhone(phone) || note.length > 1000 || consent !== true) throw new Error('Confira os campos e o aceite antes de continuar.');
  if (plan && (typeof plan.name !== 'string' || !plan.name || !Number.isSafeInteger(plan.price) || plan.price <= 0 || typeof plan.frequency !== 'string')) throw new Error('Não foi possível identificar o plano. Feche e selecione novamente.');
  const agenda = validateSchedules(plan,schedules);
  const interest = plan ? [
    'Olá, Rejane! Tenho interesse neste plano:', '',
    `Plano: ${plan.name}`, `Valor anunciado: ${formatPlanPrice(plan.price)}/mês`,
    `${plan.online ? 'Modalidade' : 'Frequência'}: ${plan.frequency}`,
    ...(plan.online && demoLesson ? ['Adicional de interesse: aula presencial demonstrativa (+ R$ 200).'] : []), '',
  ] : ['Olá, Rejane! Gostaria de agendar um atendimento.', ''];
  const message = [
    ...interest,
    ...agenda.flatMap((days,index) => [
      `${index+1}ª opção de agenda:`,
      ...[...days].sort((a,b) => a.day - b.day).map(item => `${WEEK_DAYS[item.day]}: ${item.time}`), '',
    ]),
    ...(agenda.length ? ['Preferências sujeitas à confirmação da Rejane; não reservam horários.',''] : []),
    `Nome: ${cleanName}`, `WhatsApp: ${formatPhone(phone)}`,
    `Observação: ${note || 'Não informada.'}`, '',
    ...(plan ? ['Gostaria de confirmar a disponibilidade e os próximos passos.',''] : []),
    'Autorizo o uso dos dados informados para contato, conforme a política de privacidade do site.',
  ].join('\n');
  return `https://wa.me/5561982920780?text=${encodeURIComponent(message)}`;
}
