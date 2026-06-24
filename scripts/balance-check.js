const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={window:{},console,Math,Object,Array,JSON};ctx.window.GameData={};vm.createContext(ctx);
for(const f of ['data.js','balance.js','gear.js','costumes.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'),ctx,{filename:f});
const G=ctx.window.GameData, B=ctx.window.Balance, SK=G.SKILLS, COS=G.COSTUMES, CH=G.CHARACTERS;
// 收集所有「服装专属招式」
const sigIds=new Set();
Object.values(COS).forEach(c=>c.signature&&sigIds.add(c.signature));
sigIds.add('basic_attack');
console.log('=== 角色专属招式 平衡分（1.00=正好在线，|偏差|<0.18 达标）===');
let bad=0;
[...sigIds].sort().forEach(id=>{const s=SK[id];if(!s)return;const sc=B.score(s);const flag=Math.abs(sc-1)>0.18?'  ⚠超标':'';if(flag)bad++;
  const t={enemySingle:'单',enemyRow:'排',enemyAll:'群',allyAll:'群友',allySingle:'单友',self:'己'}[s.target]||s.target;
  const mods=[s.pierce&&'穿',s.knockback&&'退',s.inflict&&s.inflict.type,s.extra&&s.extra.type].filter(Boolean).join('/');
  console.log(`${id.padEnd(17)} sp${s.sp||0} ${s.effect.padEnd(7)} ${t.padEnd(3)} pow ${String(Math.round(s.power*100)/100).padEnd(5)} ${mods.padEnd(14)} 分 ${sc.toFixed(2)}${flag}`);});
console.log(`--- 超标 ${bad} 个 ---`);
// 每个角色初始服装的招式
console.log('\n=== 16 角色「初始服装」专属招式 ===');
Object.values(CH).forEach(ch=>{const c=COS['base_'+ch.id];const s=SK[c.signature];
  console.log(`${ch.name.padEnd(6)} ${ch.element}/${ch.cls}  →  ${s.name}（${c.signature}）`);});
