import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateAppointment} from '../appointments.mjs';

test('solicitação valida autorização, plano e agenda; descarta campos extras',() => {
  const input={requestId:randomUUID(),name:' Maria ',phone:'+55 61 99999-9999',observation:' Pela manhã ',consent:true,plan:null,demoLesson:false,schedules:[],extra:'não armazenar'};
  const {data}=validateAppointment(input);
  assert.equal(data.name,'Maria'); assert.equal(data.phone,'61999999999'); assert.equal(data.observation,'Pela manhã'); assert.equal(data.extra,undefined);
  for(const invalid of [{consent:false},{name:' '},{phone:'123'},{requestId:'invalid'},{plan:{name:'Online',price:1,online:true}}]) assert.throws(()=>validateAppointment({...input,...invalid}),{status:422});
  const online=validateAppointment({...input,plan:{name:'Online',price:250,online:true},demoLesson:true}).data;
  assert.equal(online.demoLesson,true); assert.equal(online.plan.frequency,'Consultoria online');
  const presencial={...input,plan:{name:'Presencial 5x',price:4000,online:false},schedules:[Array.from({length:5},(_,day)=>({day,time:'17:00'}))]};
  assert.equal(validateAppointment(presencial).data.schedules[0].length,5);
  assert.throws(()=>validateAppointment({...presencial,schedules:[]}),{status:422});
});
