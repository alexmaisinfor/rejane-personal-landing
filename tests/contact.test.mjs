import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildContactUrl,formatPhone,validPhone,validateSchedules,planDayCount} from '../assets/contact-utils.mjs';

test('agendamento valida telefone, exige aceite e codifica a mensagem',() => {
  for (const phone of ['(61) 99999-9999','+55 61 99999-9999','(11) 3333-4444']) assert.equal(validPhone(phone),true);
  for (const phone of ['99999-9999','00000000000','619123','61123456789']) assert.equal(validPhone(phone),false);
  assert.equal(formatPhone('+55 61 99999-9999'),'(61) 99999-9999');
  const input={name:' Maria & José ',phone:'+55 61 99999-9999',observation:'Treino pela manhã.\nObjetivo: força & saúde?',consent:true};
  const url=new URL(buildContactUrl(input));
  assert.equal(url.origin,'https://wa.me'); assert.equal(url.pathname,'/5561982920780');
  const text=url.searchParams.get('text');
  assert.ok(text.includes('Nome: Maria & José'));
  assert.ok(text.includes('WhatsApp: (61) 99999-9999'));
  assert.ok(text.includes(input.observation));
  assert.ok(text.includes('Autorizo o uso dos dados'));
  assert.equal([...url.searchParams.keys()].length,1);
  assert.throws(() => buildContactUrl({...input,consent:false}));
  assert.throws(() => buildContactUrl({...input,name:' '}));
  assert.throws(() => buildContactUrl({...input,phone:'123'}));
  assert.throws(() => buildContactUrl({...input,observation:'a'.repeat(1001)}));
  assert.ok(new URL(buildContactUrl({...input,observation:''})).searchParams.get('text').includes('Observação: Não informada.'));
});

test('mensagem dos seis planos e adicional exclusivo do Online',() => {
  const input={name:'Maria Silva',phone:'61999999999',observation:'Prefiro treinar pela manhã.',consent:true};
  const plans=[{name:'Online',price:250,online:true,frequency:'Consultoria online'},...Array.from({length:5},(_,index)=>({name:`Presencial ${index+1}x`,price:800*(index+1),online:false,frequency:`${index+1} ${index===0?'dia':'dias'} por semana com acompanhamento.`}))];
  for(const plan of plans){
    const schedules=plan.online ? [] : [Array.from({length:planDayCount(plan)},(_,day)=>({day,time:'07:00'}))];
    const text=new URL(buildContactUrl({...input,plan,schedules})).searchParams.get('text');
    assert.ok(text.includes(`Plano: ${plan.name}`));
    assert.ok(text.includes(new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(plan.price)+'/mês'));
    assert.ok(text.includes(plan.frequency));
    assert.ok(text.includes('confirmar a disponibilidade'));
    assert.ok(!text.includes('Adicional de interesse'));
  }
  const demo=new URL(buildContactUrl({...input,plan:plans[0],demoLesson:true})).searchParams.get('text');
  assert.ok(demo.includes('aula presencial demonstrativa (+ R$ 200)'));
  const presencial=new URL(buildContactUrl({...input,plan:plans[1],demoLesson:true,schedules:[[{day:0,time:'07:00'}]]})).searchParams.get('text');
  assert.ok(!presencial.includes('Adicional de interesse'));
  const general=new URL(buildContactUrl({...input,demoLesson:true})).searchParams.get('text');
  assert.ok(!general.includes('Plano:'));
  assert.ok(!general.includes('Adicional de interesse'));
  assert.throws(()=>buildContactUrl({...input,plan:{...plans[0],price:0}}));
});

test('agenda presencial: frequência, dias únicos, horários e alternativa completa',() => {
  for(let count=1;count<=5;count++) {
    const plan={name:`Presencial ${count}x`,price:800*count,frequency:`${count} dias por semana`,online:false};
    const first=Array.from({length:count},(_,day)=>({day,time:'07:00'}));
    const second=first.map(item=>({...item,time:'17:00'}));
    assert.equal(planDayCount(plan),count);
    assert.deepEqual(validateSchedules(plan,[first]),[first]);
    assert.deepEqual(validateSchedules(plan,[first,second]),[first,second]);
    assert.throws(()=>validateSchedules(plan,[]));
    assert.throws(()=>validateSchedules(plan,[first.slice(1)]));
    assert.throws(()=>validateSchedules(plan,[first,[]]));
    assert.throws(()=>validateSchedules(plan,[first,[...first].reverse()]));
    assert.throws(()=>validateSchedules(plan,[first,second,first]));
    assert.throws(()=>validateSchedules(plan,[[{...first[0],time:'24:00'},...first.slice(1)]]));
    assert.throws(()=>validateSchedules(plan,[[{...first[0],day:7},...first.slice(1)]]));
    if(count>1) assert.throws(()=>validateSchedules(plan,[[first[0],first[0],...first.slice(2)]]));
    const text=new URL(buildContactUrl({name:'Maria',phone:'61999999999',consent:true,plan,schedules:[first,second]})).searchParams.get('text');
    assert.ok(text.includes('1ª opção de agenda:'));
    assert.ok(text.includes('2ª opção de agenda:'));
    assert.ok(text.includes('Segunda-feira: 07:00'));
    assert.ok(text.includes('Segunda-feira: 17:00'));
    assert.ok(text.includes('não reservam horários'));
    const withoutAlternative=new URL(buildContactUrl({name:'Maria',phone:'61999999999',consent:true,plan,schedules:[first]})).searchParams.get('text');
    assert.ok(!withoutAlternative.includes('2ª opção'));
  }
  assert.deepEqual(validateSchedules(null,[]),[]);
  assert.deepEqual(validateSchedules({online:true},[]),[]);
});

test('agenda permite apenas dias úteis entre 06:00 e 17:00 nas duas opções',() => {
  const plan={name:'Presencial 1x',price:800,frequency:'1 dia por semana',online:false};
  for(const day of [0,1,2,3,4]) for(const time of ['06:00','12:00','17:00']) {
    assert.doesNotThrow(()=>validateSchedules(plan,[[{day,time}]]));
  }
  for(const day of [5,6,-1]) assert.throws(()=>validateSchedules(plan,[[{day,time:'10:00'}]]));
  for(const time of ['02:08','05:59','06:01','12:30','17:01','18:00','18:30','23:59']) {
    assert.throws(()=>validateSchedules(plan,[[{day:0,time}]]));
    assert.throws(()=>validateSchedules(plan,[[{day:0,time:'06:00'}],[{day:1,time}]]));
  }
  assert.throws(()=>validateSchedules(plan,[[{day:0,time:'06:00'}],[{day:5,time:'12:00'}]]));
});
