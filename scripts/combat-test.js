const fs=require('fs'),vm=require('vm'),path=require('path');
const store={};
const ctx={console,Math,Object,Array,JSON,Date,setTimeout,clearTimeout,
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]}};
ctx.window=ctx; ctx.window.GameData={};
vm.createContext(ctx);
for(const f of ['data.js','balance.js','gear.js','costumes.js','game.js','battle.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),ctx,{filename:f});
const {Game,Battle,GameData}=ctx.window;
Game.init();

function drive(){
  let guard=0, sigUsed=false, threw=null;
  try{
    while(!Battle.finished && guard++<300){
      const c=Battle.current();
      if(!c||!c.alive){Battle.advance();continue;}
      if(Battle.isStunned(c)){Battle.consumeStun(c);Battle.advance();continue;}
      if(c.side==='enemy'){Battle.enemyAct();}
      else{
        // 智能选择：优先可用的最高 SP 技能（=专属大招），确保大招被实测；否则便宜技；否则普攻
        const usable=c.skills.filter(id=>id!=='basic_attack'&&Battle.canUseSkill(c,id));
        usable.sort((a,b)=>((GameData.SKILLS[b].sp||0)-(GameData.SKILLS[a].sp||0))||(GameData.SKILLS[b].power-GameData.SKILLS[a].power));
        const chosen=usable[0]||'basic_attack';
        if(chosen!=='basic_attack') sigUsed=true;
        const picked=(Battle.validTargets(c,chosen)||[])[0];
        Battle.executeSkill(c,chosen,picked);
      }
      Battle.checkEnd(); Battle.advance();
    }
  }catch(e){threw=e;}
  return {result:Battle.result,guard,sigUsed,threw};
}

// 1) 每个角色单挑：验证其专属招式能正常释放、无异常
const chars=Object.keys(GameData.CHARACTERS);
let fails=0;
console.log('=== 16 角色专属招式 实战执行 ===');
chars.forEach(cid=>{
  const o=Game.makeOwned(cid,25); Game.state.roster=[o]; Game.state.team=[o.uid];
  const stage={id:'ct',name:'t',enemies:[{id:'goblin',level:3,pos:'front'},{id:'goblin_archer',level:3,pos:'back'}],reward:{}};
  Battle.setup([o.uid],stage);
  const sig=GameData.COSTUMES['base_'+cid].signature;
  const r=drive();
  const ok=!r.threw && r.sigUsed;
  if(!ok) fails++;
  console.log(`${GameData.CHARACTERS[cid].name.padEnd(6)} ${sig.padEnd(16)} 释放:${r.sigUsed?'✓':'✗'} 结果:${r.result||'-'} 回合:${r.guard}${r.threw?'  ✗异常:'+r.threw.message:''}`);
});

// 2) 五人队打主线第1关：应获胜
const team=['lecliss','justia','mina','seir','garcia'].map(cid=>{const o=Game.makeOwned(cid,18);return o;});
Game.state.roster=team; Game.state.team=team.map(o=>o.uid);
const s1=GameData.STAGES[0];
Battle.setup(Game.state.team,{id:s1.id,name:s1.name,enemies:s1.enemies.map(e=>({...e})),reward:s1.reward});
const r2=drive();
console.log('\n=== 五人队 vs 第1关 ===');
console.log('结果:',r2.result,'回合:',r2.guard, r2.threw?('异常:'+r2.threw.message):'');
console.log(`\n单挑失败 ${fails}/16`);
