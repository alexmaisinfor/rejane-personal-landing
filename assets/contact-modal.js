import {normalizePhone,validPhone,formatPhone,buildContactUrl,formatPlanPrice,planDayCount,WEEK_DAYS,validateSchedules} from './contact-utils.mjs';
const dialog = document.querySelector('#contact-dialog');
const form = document.querySelector('#contact-form');
const name = form.elements.contactName;
const phone = form.elements.contactPhone;
const observation = form.elements.contactObservation;
const error = document.querySelector('#contact-error');
const planSummary = document.querySelector('#contact-plan-summary');
const demoOption = document.querySelector('#contact-demo-option');
const scheduleSection = document.querySelector('#contact-schedules');
const firstSchedule = document.querySelector('#contact-schedule-first');
const secondSchedule = document.querySelector('#contact-schedule-second');
const addAlternative = document.querySelector('#contact-add-alternative');
function buildScheduleRows(fieldset,count) {
  const rows = fieldset.querySelector('.schedule-rows'); rows.replaceChildren();
  for (let index=0;index<count;index++) {
    const row = document.createElement('div'); row.className = 'schedule-row';
    const dayLabel = document.createElement('label'); dayLabel.textContent = `Dia ${index+1}`;
    const select = document.createElement('select'); select.required = true; select.className = 'schedule-day';
    select.append(new Option('Selecione o dia',''));
    WEEK_DAYS.forEach((day,number) => select.append(new Option(day,String(number))));
    dayLabel.append(select);
    const timeLabel = document.createElement('label'); timeLabel.textContent = 'Horário';
    const time = document.createElement('input'); time.type = 'time'; time.required = true; time.step = '60'; time.className = 'schedule-time'; time.setAttribute('aria-label',`Horário do dia ${index+1}, ${fieldset === firstSchedule ? 'primeira' : 'segunda'} opção`);
    timeLabel.append(time); row.append(dayLabel,timeLabel); rows.append(row);
  }
}
function resetSchedules() {
  scheduleSection.hidden = true;
  for (const fieldset of [firstSchedule,secondSchedule]) { fieldset.disabled = true; fieldset.querySelector('.schedule-rows').replaceChildren(); }
  secondSchedule.hidden = true; addAlternative.hidden = false; addAlternative.setAttribute('aria-expanded','false');
}
function readSchedule(fieldset) {
  return [...fieldset.querySelectorAll('.schedule-row')].map(row => ({day:row.querySelector('select').value === '' ? NaN : Number(row.querySelector('select').value),time:row.querySelector('input').value}));
}
function selectedSchedules() {
  return scheduleSection.hidden ? [] : [readSchedule(firstSchedule),...(!secondSchedule.hidden ? [readSchedule(secondSchedule)] : [])];
}
scheduleSection.addEventListener('change',event => {
  error.textContent = '';
  const fieldset = event.target.closest('fieldset');
  if (!fieldset) return;
  const selects = [...fieldset.querySelectorAll('select')];
  for (const select of selects) for (const option of select.options) option.disabled = option.value !== '' && selects.some(other => other !== select && other.value === option.value);
});
addAlternative.addEventListener('click',() => {
  buildScheduleRows(secondSchedule,planDayCount(selectedPlan));
  secondSchedule.hidden = false; secondSchedule.disabled = false;
  addAlternative.hidden = true; addAlternative.setAttribute('aria-expanded','true');
  secondSchedule.querySelector('select').focus();
});
document.querySelector('#contact-remove-alternative').addEventListener('click',() => {
  secondSchedule.hidden = true; secondSchedule.disabled = true; secondSchedule.querySelector('.schedule-rows').replaceChildren();
  addAlternative.hidden = false; addAlternative.setAttribute('aria-expanded','false'); error.textContent = ''; addAlternative.focus();
});
let selectedPlan = null;
let opener;
document.querySelectorAll('[data-open-contact]').forEach(button => {
  button.addEventListener('click',() => {
    selectedPlan = null;
    resetSchedules();
    form.elements.contactDemo.checked = false;
    const card = button.closest('.plan');
    if (card) {
      const title = card.querySelector('h3').textContent.trim();
      const amount = card.querySelector('.price').textContent.split('/')[0].replace(/\D/g,'');
      selectedPlan = {
        name:title,price:Number(amount),online:title === 'Online',
        frequency:title === 'Online' ? 'Consultoria online' : card.querySelector('.plan-description').textContent.trim().replace(/\s+/g,' '),
      };
      document.querySelector('#contact-plan-name').textContent = selectedPlan.name;
      document.querySelector('#contact-plan-price').textContent = formatPlanPrice(selectedPlan.price) + '/mês';
      document.querySelector('#contact-plan-frequency').textContent = selectedPlan.frequency;
    }
    planSummary.hidden = !selectedPlan;
    demoOption.hidden = !selectedPlan?.online;
    const days = planDayCount(selectedPlan);
    if (days) {
      scheduleSection.hidden = false; firstSchedule.disabled = false;
      document.querySelector('#contact-schedule-hint').textContent = `Escolha ${days} ${days === 1 ? 'dia distinto' : 'dias distintos'} e um horário para cada dia, conforme seu plano.`;
      buildScheduleRows(firstSchedule,days);
    }
    opener = button; dialog.showModal(); document.body.classList.add('contact-modal-open');
  });
});
document.querySelector('#close-contact').addEventListener('click',() => dialog.close());
dialog.addEventListener('close',() => {
  document.body.classList.remove('contact-modal-open');
  form.reset(); phone.setCustomValidity(''); name.setCustomValidity(''); error.textContent = '';
  selectedPlan = null; planSummary.hidden = true; demoOption.hidden = true;
  resetSchedules();
  opener?.focus();
});
dialog.addEventListener('click',event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
phone.addEventListener('input',() => {
  phone.setCustomValidity('');
  const digits = normalizePhone(phone.value);
  if (digits.length <= 11) phone.value = formatPhone(digits);
});
phone.addEventListener('blur',() => {
  if (validPhone(phone.value)) phone.value = formatPhone(phone.value);
});
name.addEventListener('input',() => name.setCustomValidity(''));
form.addEventListener('submit',event => {
  event.preventDefault();
  name.setCustomValidity(name.value.trim().length >= 2 && !/[\u0000-\u001f]/.test(name.value) ? '' : 'Informe seu nome de contato.');
  phone.setCustomValidity(validPhone(phone.value) ? '' : 'Informe um WhatsApp válido com DDD. Exemplo: (61) 99999-9999.');
  if (!form.reportValidity()) return;
  try {
    const schedules = validateSchedules(selectedPlan,selectedSchedules());
    const url = buildContactUrl({name:name.value,phone:phone.value,observation:observation.value,consent:form.elements.contactConsent.checked,plan:selectedPlan,demoLesson:form.elements.contactDemo.checked,schedules});
    // Only this user-initiated navigation transmits the data to WhatsApp.
    dialog.close();
    location.assign(url);
  } catch (exception) { error.textContent = exception.message; error.focus(); }
});
