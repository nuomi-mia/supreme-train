/* ================================================================================
   app.js — 糯米饲养助手
   ================================================================================ */
window.onerror = function(msg, url, line) {
  var el = document.getElementById('view-dashboard');
  if (el) el.innerHTML = '<div style="padding:20px;background:#FFEBEE;border-radius:12px"><h2>错误</h2><p>'+msg+'</p><p>行: '+line+'</p></div>';
  return true;
};

function whenReady(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

whenReady(function() {
  var d = DataManager.data(); if (!d) return;
  if (!d.dewormingRecords) d.dewormingRecords = [{ id: 'dew_1', type: 'internal_external', productName: '体内外同驱', brand: '', date: '2026-06-03', nextDueDate: '2026-07-03', hospital: '', cost: 0, note: '第一次驱虫，体内外同驱' }];
  d.inventory.forEach(function(item) { if (item.name.indexOf('羊奶粉') !== -1) item.category = 'staple'; if (item.name.indexOf('补血肝精') !== -1) item.category = 'supplement'; });
  if (!d.healthEvents) d.healthEvents = [];
  if (CONFIG.MEAL_UNITS.indexOf('kg') === -1) CONFIG.MEAL_UNITS.push('kg');
  // Deduplicate by splicing in place
  if (d.healthCheckRecords && d.healthCheckRecords.length > 1) {
    d.healthCheckRecords.sort(function(a,b){return b.date.localeCompare(a.date)||(b.id||'').localeCompare(a.id||'');});
    var hcSeen = {};
    for (var i = d.healthCheckRecords.length - 1; i >= 0; i--) {
      var r = d.healthCheckRecords[i];
      var k = r.date + '|' + (r.hospital||'') + '|' + (r.chiefComplaint||'');
      if (hcSeen[k]) { d.healthCheckRecords.splice(i, 1); }
      else { hcSeen[k] = true; }
    }
  }
  if (d.medicalRecords && d.medicalRecords.length > 1) {
    d.medicalRecords.sort(function(a,b){return b.date.localeCompare(a.date)||(b.id||'').localeCompare(a.id||'');});
    var medSeen = {};
    for (var j = d.medicalRecords.length - 1; j >= 0; j--) {
      var mr = d.medicalRecords[j];
      var mk = mr.date + '|' + (mr.hospital||'') + '|' + (mr.diagnosis||'');
      if (medSeen[mk]) { d.medicalRecords.splice(j, 1); }
      else { medSeen[mk] = true; }
    }
  }
  DataManager._save();
});

function preciseAge(bs) { var b=new Date(bs+'T00:00:00'),n=new Date(); var y=n.getFullYear()-b.getFullYear(),m=n.getMonth()-b.getMonth(),d=n.getDate()-b.getDate(); if(d<0){m--;d+=new Date(n.getFullYear(),n.getMonth(),0).getDate();} if(m<0){y--;m+=12;} if(y>0)return y+'岁'+m+'个月'+d+'天'; if(m>0)return m+'个月'+d+'天'; return d+'天'; }
function padDays(as) { return Math.floor((new Date()-new Date(as+'T00:00:00'))/86400000)+'天'; }
function daysBt(d1,d2) { return Math.round(Math.abs(new Date(d1+'T00:00:00')-new Date(d2+'T00:00:00'))/86400000); }

function bindQN(noteId, qnId, refresh) {
  var ni=document.getElementById(noteId), qd=document.getElementById(qnId); if(!ni||!qd)return;
  ni.onfocus=function(){qd.style.display='flex';}; ni.onblur=function(){setTimeout(function(){if(!qd.matches(':hover'))qd.style.display='none';},150);};
  qd.querySelectorAll('.quick-note-chip').forEach(function(c){c.onclick=function(e){e.preventDefault(); if(this.id==='btn-save-note'){var nv=ni.value.trim(); if(nv&&DataManager.getCommonNotes().indexOf(nv)===-1){DataManager.addCommonNote(nv);showToast('已保存');if(refresh)refresh();}return;} ni.value=this.dataset.note;ni.focus();};});
}
function buildQN(notes) { var h='<div class="quick-notes" id="quick-notes" style="display:none">'; notes.forEach(function(n){h+='<span class="quick-note-chip" data-note="'+Utils.escape(n)+'">'+Utils.escape(n.length>14?n.slice(0,14)+'...':n)+'</span>';}); h+='<span class="quick-note-chip save-chip" id="btn-save-note">+ 保存</span></div>'; return h; }
function saveNote(nt) { if(nt.trim()&&DataManager.getCommonNotes().indexOf(nt.trim())===-1)DataManager.addCommonNote(nt.trim()); }

// ===== 1. 看板 =====
UIRenderer.renderDashboard = function() {
  var cat=DataManager.data().catInfo,status=DataManager.getTodayFeedingStatus(),tf=DataManager.getTodayFeeding();
  var nv=DataManager.getNextVaccine(),lw=DataManager.getLatestWeight(),wr=DataManager.getWeightRecordsSorted();
  var al=DataManager.getInventoryAlerts(),rc=DataManager.getRemindersByFilter('today'),te=DataManager.getTodayExcretion();
  var dw=(DataManager.getSection('dewormingRecords')||[]).sort(function(a,b){return b.date.localeCompare(a.date);});
  var allHc=DataManager.getSection('healthCheckRecords'),ra=[];
  if(allHc.length>0){var recentHc=allHc.filter(function(h){return Utils.daysBetween(new Date(h.date+'T00:00:00'),Utils.todayDate())<=30;});recentHc.forEach(function(h){if(h.examinationItems)h.examinationItems.filter(function(ex){return ex.isAbnormal;}).forEach(function(ex){ra.push({name:ex.name,result:ex.result,unit:ex.unit,referenceRange:ex.referenceRange,date:h.date});});});}
  var he=DataManager.getSection('healthEvents')||[],upHe=he.filter(function(e){return !e.completed&&e.date>=Utils.todayStr();}).sort(function(a,b){return a.date.localeCompare(b.date);});
  var diary=[].concat(DataManager.getSection('growthDiary')).sort(function(a,b){return b.date.localeCompare(a.date);}),latestDiary=diary.length>0?diary[0]:null;

  var h='';
  h+='<div class="card cat-profile-card" id="dash-cat-card"><div class="cat-avatar-large">'+(cat.photo?'<img src="'+cat.photo+'" alt="">':'🐱')+'</div>';
  h+='<div class="cat-info"><h2>'+Utils.escape(cat.name)+'</h2><div class="cat-badges"><span class="badge">'+Utils.escape(cat.breed)+'</span><span class="badge">'+preciseAge(cat.birthDate)+'</span><span class="badge">'+(cat.gender==='female'?'♀ 妹妹':'♂ 弟弟')+'</span><span class="badge">'+(cat.fixed?'已绝育':'未绝育')+'</span></div>';
  h+='<p style="margin-top:4px;font-size:12px;color:var(--color-text-secondary)">📍 '+Utils.escape(cat.location||'')+' · 💝 已陪伴您 '+padDays(cat.adoptionDate)+'</p>';
  h+='<p style="margin-top:2px;font-size:11px;color:var(--color-text-muted)">点击卡片查看全部信息 ▾</p></div>';
  h+='<div class="cat-detail-section" id="cat-detail" style="display:none"><div class="cat-detail-grid">';
  h+='<span>📅 生日</span><span class="val">'+cat.birthDate+'（'+preciseAge(cat.birthDate)+'）</span><span>🏠 到家</span><span class="val">'+cat.adoptionDate+'（已陪伴 '+padDays(cat.adoptionDate)+'）</span>';
  h+='<span>🐱 品种</span><span class="val">'+Utils.escape(cat.breed)+'</span><span>🎨 花色</span><span class="val">'+Utils.escape(cat.color||'')+'</span>';
  h+='<span>⚧ 性别</span><span class="val">'+(cat.gender==='female'?'♀ 妹妹':'♂ 弟弟')+'</span><span>🏥 绝育</span><span class="val">'+(cat.fixed?'已绝育':'未绝育')+'</span>';
  h+='<span>📍 居住地</span><span class="val">'+Utils.escape(cat.location||'')+'</span></div></div></div>';

  var actMsgs={'⚡⚡⚡ 非常活跃':'🐱 今天元气满满！跑酷小能手已上线~','⚡⚡ 适中':'😺 活力刚刚好，是只健康自律的小猫咪！','⚡ 较安静':'😌 今天想做一枚安静的美喵子~','💤 嗜睡':'💤 充电ing…小猫长身体要多睡觉觉哦！'};
  var moodMsgs={'😊 开心':'😸 尾巴翘高高~','😴 困倦':'🥱 打个哈欠继续睡…','😾 不满':'😾 是不是罐罐没给够？','🤪 调皮':'😈 今天又干了什么坏事呀~','😌 惬意':'☺️ 阳光正好，适合打个盹~','😰 紧张':'🥺 多抱抱多安抚哦~'};
  var showAct=latestDiary&&(latestDiary.activity||latestDiary.mood);
  if(showAct){h+='<div class="card card-clickable" data-nav="diary"><h3>🐾 今日状态 <span style="font-size:11px;font-weight:400;color:var(--color-text-muted);margin-left:auto">成长→</span></h3>';if(latestDiary.activity){h+='<p style="font-size:13px;margin-bottom:4px">'+Utils.escape(latestDiary.activity)+'</p>';var am=actMsgs[latestDiary.activity]||'';if(am)h+='<p style="font-size:13px;color:var(--color-text-secondary)">'+am+'</p>';}if(latestDiary.mood){h+='<p style="font-size:12px;color:var(--color-text-secondary)">'+Utils.escape(latestDiary.mood)+' — '+(moodMsgs[latestDiary.mood]||'');}h+='</div>';}

  h+='<div class="card card-clickable" data-nav="feeding-record"><h3>🍽️ 今日喂食 <span style="font-size:11px;font-weight:400;color:var(--color-text-muted);margin-left:auto">详情→</span></h3><div class="feeding-slots">';
  h+='<div class="feeding-slot'+(status.morning?' done':'')+'">☀️ 早餐'+(status.morning?' ✅':' ⏳')+'</div><div class="feeding-slot'+(status.evening?' done':'')+'">🌙 晚餐'+(status.evening?' ✅':' ⏳')+'</div><div class="feeding-slot'+(status.other?' done':'')+'">🍖 加餐'+(status.other?' ✅':'')+'</div></div>';
  if(tf.length>0){h+='<div style="margin-top:8px;font-size:12px">';tf.forEach(function(r){var is=r.items.map(function(i){return i.name+(i.amount?' '+i.amount+i.unit:'');}).join(', ');h+='<div style="display:flex;gap:4px;padding:2px 0"><span style="color:var(--color-text-muted)">'+(r.timeOfDay==='morning'?'☀️':r.timeOfDay==='evening'?'🌙':'🍖')+'</span><span>'+Utils.escape(is)+'</span></div>';});h+='</div>';}
  h+='</div>';

  h+='<div class="card-grid-2col"><div class="card card-clickable" data-nav="feeding-excretion"><h3>💩 今日排泄</h3>';
  if(te.length>0){h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';te.forEach(function(ex){var clr='#81C784';if(ex.stoolConsistency==='diarrhea')clr='#E57373';else if(ex.stoolConsistency==='soft')clr='#FFD54F';var si=CONFIG.STOOL_CONSISTENCY.find(function(s){return s.value===ex.stoolConsistency;})||{};h+='<span style="font-size:12px;padding:3px 8px;background:'+clr+'15;border-radius:12px;border:1px solid '+clr+'">'+(ex.type==='pee'?'💧':'💩')+' '+(si.label||'')+'</span>';});h+='</div>';}else{h+='<p class="sub">暂无排泄记录</p>';}
  h+='</div>';
  var nd=dw.filter(function(d){return d.nextDueDate&&d.nextDueDate>=Utils.todayStr();})[0]||null;
  h+='<div class="card card-clickable" data-nav="health-deworming"><h3>🪱 下次驱虫</h3>';
  if(nd){var ddl=Utils.daysBetween(Utils.todayDate(),new Date(nd.nextDueDate+'T00:00:00'));h+='<p class="highlight-date">'+Utils.formatDateShort(nd.nextDueDate)+'</p><p class="sub">'+Utils.escape(nd.productName||'驱虫')+' · 还有 '+ddl+' 天</p>';}else{h+='<p class="sub">暂无待驱虫</p>';}
  h+='</div></div>';

  h+='<div class="card-grid-2col"><div class="card card-clickable" data-nav="health-weight"><h3>⚖️ 体重</h3>';
  if(lw){h+='<p class="highlight">'+lw.weight.toFixed(1)+' <small>kg</small></p><canvas id="weight-sparkline" width="150" height="50"></canvas>';}else{h+='<p class="sub">暂无体重记录</p>';}
  h+='</div><div class="card card-clickable" data-nav="health-overview"><h3>💉 下次疫苗</h3>';
  if(nv){var vdl=Utils.daysBetween(Utils.todayDate(),new Date(nv.nextDueDate+'T00:00:00'));h+='<p class="highlight-date">'+Utils.formatDateShort(nv.nextDueDate)+'</p><p class="sub">'+Utils.escape(nv.vaccineName)+' · 还有 '+vdl+' 天</p>';}else{h+='<p class="sub">暂无待接种疫苗</p>';}
  h+='</div></div>';

  h+='<div class="card card-clickable" data-nav="feeding-inventory"><div style="display:flex;align-items:center;justify-content:space-between"><h3 style="margin:0">📦 库存</h3>';
  var totalAlerts=0;al.forEach(function(e){totalAlerts+=e.alerts.length;});
  if(totalAlerts>0){h+='<span style="font-size:11px;background:#FFEBEE;color:#C62828;padding:2px 8px;border-radius:10px">'+totalAlerts+' 项待处理</span>';}
  else{h+='<span style="font-size:11px;color:var(--color-success)">状态良好 ✅</span>';}
  h+='</div>';
  if(al.length>0){h+='<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">';al.slice(0,4).forEach(function(e){e.alerts.forEach(function(al){h+='<span class="alert-item '+al.severity+'" style="font-size:10px;padding:2px 8px;border-radius:12px;white-space:nowrap">'+(al.severity==='danger'?'🔴':al.severity==='warning'?'⚠️':'ℹ️')+' '+Utils.escape(e.item.name)+' '+al.msg+'</span>';});});h+='</div>';}
  h+='</div>';

  if(upHe.length>0){h+='<div class="card card-clickable" data-nav="health-overview"><div style="display:flex;align-items:center;justify-content:space-between"><h3 style="margin:0">📅 即将到来</h3><span style="font-size:11px;color:var(--color-text-muted)">'+upHe.length+' 项</span></div><div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">';upHe.slice(0,4).forEach(function(e){var edl=Utils.daysBetween(Utils.todayDate(),new Date(e.date+'T00:00:00'));h+='<span class="alert-item '+(edl<=7?'warning':'info')+'" style="font-size:10px;padding:2px 8px;border-radius:12px">'+(edl<=7?'⚠️':'ℹ️')+' '+Utils.escape(e.title)+' · '+Utils.formatDateShort(e.date)+'</span>';});h+='</div></div>';}

  if(ra.length>0){h+='<div class="card card-clickable" data-nav="health-checkup"><h3>🩺 近期体检异常 <span style="font-size:11px;font-weight:400;color:var(--color-text-muted)">30天内</span></h3>';ra.slice(0,4).forEach(function(ex){h+='<div class="alert-item danger" style="margin-bottom:2px">⚠️ '+Utils.escape(ex.name)+': '+Utils.escape(ex.result)+' '+Utils.escape(ex.unit)+'（参考: '+Utils.escape(ex.referenceRange)+'） · '+Utils.formatDateShort(ex.date)+'</div>';});h+='</div>';}

  var upr=[].concat(rc.today,rc.overdue).slice(0,5);
  if(upr.length>0){h+='<div class="card card-clickable" data-nav="reminders"><div style="display:flex;align-items:center;justify-content:space-between"><h3 style="margin:0">⏰ 提醒</h3><span style="font-size:11px;color:var(--color-text-muted)">'+upr.length+' 条</span></div><div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">';upr.forEach(function(r){var ov=r._effDate<Utils.todayStr();h+='<span class="alert-item '+(ov?'danger':'warning')+'" style="font-size:10px;padding:2px 8px;border-radius:12px">'+(ov?'🔴':'🟡')+' '+Utils.escape(r.title)+' · '+Utils.formatDateShort(r._effDate)+'</span>';});h+='</div></div>';}

  var de=document.getElementById('view-dashboard');
  if(!de) return;
  de.innerHTML=h;

  var cc=document.getElementById('dash-cat-card');
  if(cc){cc.onclick=function(e){if(e.target.closest('button')||e.target.closest('input'))return;var d=document.getElementById('cat-detail');var h=cc.querySelector('p:last-child');if(!d)return;if(d.style.display==='none'){d.style.display='block';if(h)h.textContent='再次点击收起 ▴';}else{d.style.display='none';if(h)h.textContent='点击卡片查看全部信息 ▾';}};}

  de.querySelectorAll('.card-clickable').forEach(function(card){card.addEventListener('click',function(){var nav=this.dataset.nav;if(!nav)return;var i=nav.indexOf('-');if(i>0)Router.navigateSub(nav.slice(0,i),nav.slice(i+1));else Router.navigate(nav);});});

  if(wr.length>=2){setTimeout(function(){WeightChart.drawSparkline(wr);},100);}
};

// ===== 2. 喂食记录 =====
UIRenderer.renderFeedingRecord = function() {
  var inv=DataManager.getSection('inventory').filter(function(i){return i.isActive;}),notes=DataManager.getCommonNotes();
  var allRecs=[].concat(DataManager.getSection('feedingRecords')).sort(function(a,b){return b.date.localeCompare(a.date);});
  var html='<div class="card"><form id="form-feeding"><div class="form-row"><div class="form-group"><label>日期</label><input type="date" name="date" value="'+Utils.todayStr()+'" required></div>';
  html+='<div class="form-group"><label>时段</label><select name="timeOfDay"><option value="morning">☀️ 早餐</option><option value="evening">🌙 晚餐</option><option value="other">🍖 加餐</option></select></div></div>';
  html+='<div class="form-group"><label>食物</label><div id="meal-items"></div><button type="button" class="btn-outline" id="btn-add-meal-item" style="margin-top:6px">+ 添加食物</button></div>';
  html+='<div class="form-group"><label>备注</label><textarea name="note" id="feed-note-input" placeholder="胃口如何、剩了多少..."></textarea>'+buildQN(notes)+'</div>';
  html+='<button type="submit" class="btn-primary">💾 保存喂食记录</button></form></div>';
  html+='<div class="card" style="margin-top:16px"><div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><h3 style="margin:0">📜 喂食历史</h3><div style="margin-left:auto;display:flex;gap:4px">';
  html+='<button class="btn-sm btn-outline active" id="feed-mode-cal">📅 月视图</button><button class="btn-sm btn-outline" id="feed-mode-list">📋 列表</button></div></div>';
  html+='<div id="feed-calendar-container"></div><div id="feed-list-container" style="display:none"></div><div id="feed-day-detail" class="cal-day-detail"></div></div>';
  document.getElementById('feeding-sub-record').innerHTML=html;
  bindQN('feed-note-input','quick-notes',function(){UIRenderer.renderFeedingRecord();});

  var addMealRow=function(){
    var row=document.createElement('div');row.className='meal-item-row';
    var catSel=document.createElement('select');catSel.name='category';
    [{value:'staple',label:'主食'},{value:'snack',label:'零食'},{value:'supplement',label:'营养品'},{value:'medicine',label:'药品'}].forEach(function(c){var o=document.createElement('option');o.value=c.value;o.textContent=c.label;catSel.appendChild(o);});
    row.appendChild(catSel);
    var ddWrap=document.createElement('div');ddWrap.className='food-dropdown-wrap';
    var ni=document.createElement('input');ni.type='text';ni.name='name';ni.placeholder='食物名称（可从库存选择）';ni.autocomplete='off';
    var dl=document.createElement('div');dl.className='food-dropdown-list';ddWrap.appendChild(ni);ddWrap.appendChild(dl);row.appendChild(ddWrap);
    var amt=document.createElement('input');amt.type='number';amt.name='amount';amt.placeholder='数量';amt.step='any';row.appendChild(amt);
    var us=document.createElement('select');us.name='unit';CONFIG.MEAL_UNITS.forEach(function(u){var o=document.createElement('option');o.value=u;o.textContent=u;us.appendChild(o);});row.appendChild(us);
    var rm=document.createElement('button');rm.type='button';rm.className='btn-remove';rm.textContent='✕';rm.onclick=function(){row.remove();};row.appendChild(rm);
    document.getElementById('meal-items').appendChild(row);
    var cg={staple:'🍖 主食',snack:'🍪 零食',supplement:'💊 营养品',medicine:'💉 药品'};
    var ud=function(filter){dl.innerHTML='';Object.keys(cg).forEach(function(cat){var ci=inv.filter(function(i){return i.category===cat&&(!filter||i.name.toLowerCase().indexOf(filter.toLowerCase())!==-1);});if(!ci.length)return;var grp=document.createElement('div');grp.className='food-dropdown-group';grp.textContent=cg[cat];dl.appendChild(grp);ci.forEach(function(item){var o=document.createElement('div');o.className='food-dropdown-item';o.textContent=item.name;o.onclick=function(){ni.value=item.name;catSel.value=item.category;dl.classList.remove('show');};dl.appendChild(o);});});var fv=filter||ni.value.trim();if(fv){var cu=document.createElement('div');cu.className='food-dropdown-item custom';cu.textContent='✏️ 手动输入: "'+fv+'"';cu.onclick=function(){ni.value=fv;dl.classList.remove('show');};dl.appendChild(cu);}if(dl.children.length>0)dl.classList.add('show');else dl.classList.remove('show');};
    ni.onfocus=function(){ud();};ni.oninput=function(){ud(ni.value);};ni.onblur=function(){setTimeout(function(){dl.classList.remove('show');},200);};catSel.onchange=function(){if(ni.value)ud(ni.value);};
  };
  addMealRow();document.getElementById('btn-add-meal-item').onclick=addMealRow;

  document.getElementById('form-feeding').onsubmit=function(e){e.preventDefault();var fd=new FormData(this);var date=fd.get('date'),tod=fd.get('timeOfDay');var ex=allRecs.filter(function(r){return r.date===date&&r.timeOfDay===tod;});if(ex.length>0&&date===Utils.todayStr()){if(!confirm('该时段已有记录，继续添加？'))return;}var items=[];this.querySelectorAll('.meal-item-row').forEach(function(row){var n=row.querySelector('[name="name"]').value.trim();if(n)items.push({category:row.querySelector('[name="category"]').value,name:n,amount:row.querySelector('[name="amount"]').value||'',unit:row.querySelector('[name="unit"]').value});});if(!items.length){showToast('请添加食物','danger');return;}var nt=fd.get('note')||'';saveNote(nt);DataManager.addRecord('feedingRecords',{date:date,timeOfDay:tod,mealLabel:tod==='morning'?'早餐':tod==='evening'?'晚餐':'加餐',items:items,note:nt});showToast('已保存','success');UIRenderer.renderFeedingRecord();UIRenderer.renderDashboard();Router.updateNavBadges();};

  setTimeout(function(){
    var lb=document.getElementById('feed-mode-list'),cb=document.getElementById('feed-mode-cal');
    var ld=document.getElementById('feed-list-container'),cd=document.getElementById('feed-calendar-container');
    var dd=document.getElementById('feed-day-detail');if(!lb||!cb)return;
    function rd(ds){var dr=allRecs.filter(function(r){return r.date===ds;});var dh='<h4>📅 '+Utils.formatDate(ds)+' <span style="font-size:11px;font-weight:400;color:var(--color-text-muted)">共 '+dr.length+' 条</span></h4>';if(!dr.length){dh+='<p style="font-size:12px;color:var(--color-text-muted);padding:8px">当天没有喂食记录</p>';}else{dr.forEach(function(r){var is=r.items.map(function(i){return i.name+(i.amount?' '+i.amount+i.unit:'');}).join(', ');dh+='<div class="history-meal '+r.timeOfDay+'" style="display:flex;justify-content:space-between;align-items:center"><div><span>'+(r.timeOfDay==='morning'?'☀️':r.timeOfDay==='evening'?'🌙':'🍖')+' <strong>'+r.mealLabel+'</strong>: '+Utils.escape(is)+'</span>';if(r.note)dh+='<span style="font-size:11px;color:var(--color-text-muted);margin-left:4px">'+Utils.escape(r.note)+'</span>';dh+='</div><span style="display:flex;gap:4px;flex-shrink:0"><button class="btn-sm btn-outline" data-action="edit-feed" data-id="'+r.id+'" style="font-size:10px;padding:2px 8px">✏️</button><button class="btn-sm btn-danger" data-action="delete-feed" data-id="'+r.id+'" style="font-size:10px;padding:2px 8px">✕</button></span></div>';});}dd.innerHTML=dh;dd.classList.add('show');dd.dataset.activeDate=ds;}
    function rl(){var h='',cur='';allRecs.slice(0,30).forEach(function(r){if(r.date!==cur){if(cur)h+='</div>';h+='<div class="history-day"><h4>'+r.date+'</h4>';cur=r.date;}var is=r.items.map(function(i){return i.name+(i.amount?' '+i.amount+i.unit:'');}).join(', ');h+='<div class="history-meal '+r.timeOfDay+'" style="display:flex;justify-content:space-between"><span>'+(r.timeOfDay==='morning'?'☀️':r.timeOfDay==='evening'?'🌙':'🍖')+' <strong>'+r.mealLabel+'</strong>: '+Utils.escape(is)+'</span><span style="display:flex;gap:4px">';if(r.note)h+='<span style="font-size:11px;color:var(--color-text-muted)">'+Utils.escape(r.note)+'</span>';h+='<button class="btn-sm btn-danger" data-action="delete-feed" data-id="'+r.id+'" style="font-size:10px;padding:2px 8px">✕</button></span></div>';});if(cur)h+='</div>';if(!allRecs.length)h='<p style="font-size:13px;color:var(--color-text-muted);text-align:center;padding:10px">还没有喂食记录</p>';ld.innerHTML=h;}
    function rc(){var now=new Date(),cy=now.getFullYear(),cm=now.getMonth()+1;var af={staple:true,snack:true,supplement:true,medicine:true};var cl={staple:'🟠 主食',snack:'🟡 零食',supplement:'🟢 营养品',medicine:'🔴 药品'};
    function rcc(){var h='<div class="cal-filter-bar">';Object.keys(cl).forEach(function(c){h+='<span class="cal-filter-chip'+(af[c]?' active':'')+'" data-cat="'+c+'">'+cl[c]+'</span>';});h+='</div>';h+='<div class="calendar-nav"><button id="fcal-prev">◀</button><span class="cal-month-label">'+cy+'年'+cm+'月</span><button id="fcal-next">▶</button></div>';h+='<div class="calendar-grid">';['日','一','二','三','四','五','六'].forEach(function(d){h+='<div class="cal-day-header">'+d+'</div>';});var fd=new Date(cy,cm-1,1).getDay(),dim=new Date(cy,cm,0).getDate(),ts=Utils.todayStr();for(var i=0;i<fd;i++)h+='<div class="cal-day empty"></div>';for(var d=1;d<=dim;d++){var ds=cy+'-'+String(cm).padStart(2,'0')+'-'+String(d).padStart(2,'0');var dr=allRecs.filter(function(r){return r.date===ds;});var isT=ds===ts,cats={};dr.forEach(function(r){r.items.forEach(function(i){cats[i.category]=true;});});h+='<div class="cal-day'+(isT?' today':'')+'" data-date="'+ds+'"><span class="cal-date">'+d+'</span><div class="cal-dots">';Object.keys(cats).forEach(function(c){if(af[c])h+='<span class="cal-dot '+c+'"></span>';});h+='</div></div>';}h+='</div>';cd.innerHTML=h;cd.querySelectorAll('.cal-filter-chip').forEach(function(ch){ch.onclick=function(){var c=this.dataset.cat;af[c]=!af[c];this.classList.toggle('active');rcc();};});var pb=document.getElementById('fcal-prev'),nb=document.getElementById('fcal-next');if(pb)pb.onclick=function(){cm--;if(cm<1){cm=12;cy--;}rcc();};if(nb)nb.onclick=function(){cm++;if(cm>12){cm=1;cy++;}rcc();};cd.querySelectorAll('.cal-day:not(.empty)').forEach(function(day){day.onclick=function(){rd(this.dataset.date);};});}rcc();}
    rc();rl();rd(Utils.todayStr());
    lb.onclick=function(){lb.classList.add('active');cb.classList.remove('active');ld.style.display='';cd.style.display='none';rl();};
    cb.onclick=function(){cb.classList.add('active');lb.classList.remove('active');cd.style.display='';ld.style.display='none';rc();};
  },20);

  document.getElementById('feeding-sub-record').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;if(btn.dataset.action==='delete-feed'){UIRenderer._handleDelete('feedingRecords',btn.dataset.id,function(){UIRenderer.renderFeedingRecord();UIRenderer.renderDashboard();});}else if(btn.dataset.action==='edit-feed'){var rec=allRecs.find(function(r){return r.id===btn.dataset.id;});if(rec)UIRenderer._editFeedingRecord(rec);}};
};

UIRenderer._editFeedingRecord = function(rec) {
  var html='<form id="modal-form-edit-feed">...'; // kept minimal
  // Full implementation is complex; using simplified version
  var items=rec.items||[];
  var miHTML='';items.forEach(function(i){miHTML+=i.name+' '+(i.amount||'')+i.unit+', ';});
  showToast('编辑功能简化：请删除后重新添加');
};

// ===== 3. 库存 =====
UIRenderer.renderInventory = function() {
  var items=DataManager.getSection('inventory'),cats={staple:{label:'🍖 主食',bg:'#FFF0EB',border:'#FFD1A9'},snack:{label:'🍪 零食',bg:'#FFFDE7',border:'#FFF9C4'},supplement:{label:'💊 营养品',bg:'#E8F5E9',border:'#C8E6C9'},medicine:{label:'💉 药品',bg:'#FFEBEE',border:'#FFCDD2'},supplies:{label:'🧹 日常用品',bg:'#E3F2FD',border:'#BBDEFB'}};
  var html='<div class="inventory-grid">',hasAny=false;
  Object.keys(cats).forEach(function(cat){var ci=items.filter(function(i){return i.category===cat&&i.isActive;});if(!ci.length)return;hasAny=true;var cfg=cats[cat];html+='<div style="padding:12px;border-radius:12px;background:'+cfg.bg+';border:1px solid '+cfg.border+';margin-bottom:10px"><h4 style="margin:0 0 8px;font-size:14px">'+cfg.label+' <span style="font-size:11px;color:var(--color-text-muted)">（'+ci.length+'）</span></h4>';ci.forEach(function(item){var pct=item.totalAmount>0?Math.round(item.remainingAmount/item.totalAmount*100):0,pc='';if(pct<=10)pc='critical';else if(pct<=25)pc='low';var dso='';if(item.openDate){var daysOpen=Utils.daysBetween(new Date(item.openDate+'T00:00:00'),Utils.todayDate());dso='<span>'+(daysOpen>CONFIG.FOOD_OPEN_WARN_DAYS?'⚠️ ':'')+'已开封 '+daysOpen+' 天</span>';}html+='<div class="inv-card" style="margin-bottom:6px;background:var(--color-card)"><div style="display:flex;justify-content:space-between;align-items:start"><div><h4>'+Utils.escape(item.name)+'</h4>';if(item.brand)html+='<span class="brand">'+Utils.escape(item.brand)+'</span>';html+='</div><div style="display:flex;gap:4px"><button class="btn-sm btn-outline" data-action="edit-inv" data-id="'+item.id+'">✏️</button><button class="btn-sm btn-danger" data-action="delete-inv" data-id="'+item.id+'">🗑️</button></div></div><div class="progress-wrap"><div class="progress-fill '+pc+'" style="width:'+pct+'%"></div></div><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-text-secondary)"><span>剩余 '+Number(item.remainingAmount).toFixed(item.totalUnit==='g'||item.totalUnit==='kg'?0:1)+' / '+item.totalAmount+' '+item.totalUnit+' ('+pct+'%)</span></div><div class="inv-meta">'+dso;if(item.expiryDate)html+='<span>保质至 '+item.expiryDate+'</span>';html+='</div>';if(item.note)html+='<div class="inv-meta" style="margin-top:4px">📝 '+Utils.escape(item.note)+'</div>';html+='</div>';});html+='</div>';});
  if(!hasAny)html+='<div class="empty-state"><div class="empty-icon">📦</div><p>还没有库存记录</p></div>';
  html+='</div><button class="btn-add" id="btn-add-inventory">➕ 添加库存</button>';
  document.getElementById('feeding-sub-inventory').innerHTML=html;
  document.getElementById('feeding-sub-inventory').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;if(btn.dataset.action==='edit-inv')UIRenderer._showInventoryForm(items.find(function(x){return x.id===btn.dataset.id;}));else if(btn.dataset.action==='delete-inv')UIRenderer._handleDelete('inventory',btn.dataset.id,function(){UIRenderer.renderInventory();});};
  document.getElementById('btn-add-inventory').onclick=function(){UIRenderer._showInventoryForm(null);};
};

UIRenderer._showInventoryForm = function(existing) {
  var cats=['staple','snack','supplement','medicine','supplies'],cl={staple:'主食',snack:'零食',supplement:'营养品',medicine:'药品',supplies:'日常用品'};
  var html='<form id="modal-form-inv"><div class="form-group"><label>类别</label><select name="category">';cats.forEach(function(c){html+='<option value="'+c+'"'+(existing&&existing.category===c?' selected':'')+'>'+cl[c]+'</option>';});
  html+='</select></div><div class="form-group"><label>名称</label><input type="text" name="name" value="'+(existing?Utils.escape(existing.name):'')+'" required></div>';
  html+='<div class="form-group"><label>品牌</label><input type="text" name="brand" value="'+(existing?Utils.escape(existing.brand||''):'')+'"></div>';
  html+='<div class="form-row"><div class="form-group"><label>总量</label><input type="number" name="totalAmount" step="any" value="'+(existing?existing.totalAmount:'')+'" required></div><div class="form-group"><label>单位</label><select name="totalUnit">';CONFIG.MEAL_UNITS.forEach(function(u){html+='<option value="'+u+'"'+(existing&&existing.totalUnit===u?' selected':'')+'>'+u+'</option>';});html+='</select></div></div>';
  html+='<div class="form-group"><label>剩余量</label><input type="number" name="remainingAmount" step="any" value="'+(existing?existing.remainingAmount:'')+'" required></div>';
  html+='<div class="form-row"><div class="form-group"><label>开封日期</label><input type="date" name="openDate" value="'+(existing&&existing.openDate?existing.openDate:'')+'"></div><div class="form-group"><label>保质期</label><input type="date" name="expiryDate" value="'+(existing&&existing.expiryDate?existing.expiryDate:'')+'"></div></div>';
  html+='<div class="form-group"><label>备注</label><input type="text" name="note" value="'+(existing?Utils.escape(existing.note||''):'')+'"></div></form>';
  openModal((existing?'编辑':'添加')+'库存',html,function(){var fd=new FormData(document.getElementById('modal-form-inv'));var d={category:fd.get('category'),name:fd.get('name').trim(),brand:fd.get('brand').trim(),packaging:'bag',totalAmount:parseFloat(fd.get('totalAmount'))||0,totalUnit:fd.get('totalUnit'),remainingAmount:parseFloat(fd.get('remainingAmount'))||0,openDate:fd.get('openDate')||null,expiryDate:fd.get('expiryDate')||null,batchNumber:existing?existing.batchNumber||'':'',note:fd.get('note').trim(),isActive:true};if(!d.name){showToast('请输入名称','danger');return;}if(existing)DataManager.updateRecord('inventory',existing.id,d);else DataManager.addRecord('inventory',d);closeModal();showToast('已保存','success');UIRenderer.renderInventory();UIRenderer.renderDashboard();});
};

// ===== 4. 排泄记录 =====
UIRenderer.renderExcretion = function() {
  var records=DataManager.getExcretionRecordsSorted(),notes=DataManager.getCommonNotes();
  var html='<div class="card"><form id="form-excretion"><div class="form-row"><div class="form-group"><label>日期</label><input type="date" name="date" value="'+Utils.todayStr()+'" required></div>';
  html+='<div class="form-group"><label>时段</label><select name="timeOfDay"><option value="morning">☀️ 早上</option><option value="afternoon">🌤️ 下午</option><option value="evening">🌙 晚上</option></select></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>类型</label><select name="type">';CONFIG.EXCRETION_TYPES.forEach(function(t){html+='<option value="'+t.value+'">'+t.label+'</option>';});html+='</select></div>';
  html+='<div class="form-group"><label>便便状态</label><select name="stoolConsistency"><option value="">未排便</option>';CONFIG.STOOL_CONSISTENCY.forEach(function(s){html+='<option value="'+s.value+'">'+s.label+'</option>';});html+='</select></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>排便量</label><select name="quantity"><option value="">—</option>';CONFIG.QUANTITY_LEVELS.forEach(function(q){html+='<option value="'+q.value+'">'+q.label+'</option>';});html+='</select></div>';
  html+='<div class="form-group"><label>颜色/外观</label><input type="text" name="stoolColor" placeholder="如：深棕色、成型"></div></div>';
  html+='<div class="form-group"><label>备注</label><textarea name="note" id="ex-note-input" placeholder="补充说明..."></textarea>'+buildQN(notes)+'</div>';
  html+='<button type="submit" class="btn-primary">💾 保存排泄记录</button></form></div>';
  html+='<div class="card" style="margin-top:16px"><div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><h3 style="margin:0">📜 排泄历史</h3><div style="margin-left:auto;display:flex;gap:4px">';
  html+='<button class="btn-sm btn-outline active" id="ex-mode-cal">📅 月视图</button><button class="btn-sm btn-outline" id="ex-mode-list">📋 列表</button></div></div>';
  html+='<div id="ex-calendar-container"></div><div id="ex-list-container" style="display:none"></div><div id="ex-day-detail" class="cal-day-detail"></div></div>';
  document.getElementById('feeding-sub-excretion').innerHTML=html;
  bindQN('ex-note-input','quick-notes',function(){UIRenderer.renderExcretion();});
  document.getElementById('form-excretion').onsubmit=function(e){e.preventDefault();var fd=new FormData(this);var nt=fd.get('note')||'';saveNote(nt);DataManager.addRecord('excretionRecords',{date:fd.get('date'),timeOfDay:fd.get('timeOfDay'),type:fd.get('type'),stoolConsistency:fd.get('stoolConsistency')||'',stoolColor:fd.get('stoolColor').trim(),quantity:fd.get('quantity')||'',note:nt});showToast('已保存','success');UIRenderer.renderExcretion();UIRenderer.renderDashboard();};
  setTimeout(function(){
    var lb=document.getElementById('ex-mode-list'),cb=document.getElementById('ex-mode-cal');
    var ld=document.getElementById('ex-list-container'),cd=document.getElementById('ex-calendar-container');
    var dd=document.getElementById('ex-day-detail');if(!lb||!cb)return;
    function rd(ds){var de=records.filter(function(r){return r.date===ds;});var dh='<h4>📅 '+Utils.formatDate(ds)+' <span style="font-size:11px;font-weight:400;color:var(--color-text-muted)">共 '+de.length+' 条</span></h4>';if(!de.length){dh+='<p style="font-size:12px;color:var(--color-text-muted);padding:8px">当天没有排泄记录</p>';}else{de.forEach(function(r){var ti=CONFIG.EXCRETION_TYPES.find(function(t){return t.value===r.type;})||{},si=CONFIG.STOOL_CONSISTENCY.find(function(s){return s.value===r.stoolConsistency;})||{},qi=CONFIG.QUANTITY_LEVELS.find(function(q){return q.value===r.quantity;})||{};dh+='<div class="excretion-card" style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:8px"><span class="ex-icon">'+(ti.icon||'💩')+'</span><span class="ex-type">'+(ti.label||r.type)+'</span>';if(r.stoolConsistency)dh+='<span style="font-size:11px;padding:2px 6px;border-radius:10px;background:'+(si.color||'#999')+'20;color:'+(si.color||'#999')+'">'+(si.label||r.stoolConsistency)+'</span>';if(r.quantity)dh+='<span class="ex-meta">量:'+(qi.label||r.quantity)+'</span>';if(r.stoolColor)dh+='<span class="ex-meta">颜色:'+Utils.escape(r.stoolColor)+'</span>';dh+='</div><span style="display:flex;gap:4px;align-items:center;flex-shrink:0">';if(r.note)dh+='<span class="ex-meta">'+Utils.escape(r.note)+'</span>';dh+='<button class="btn-sm btn-outline" data-action="edit-ex" data-id="'+r.id+'" style="font-size:10px;padding:2px 8px">✏️</button>';dh+='<button class="btn-sm btn-danger" data-action="delete-ex" data-id="'+r.id+'" style="font-size:10px;padding:2px 8px">✕</button></span></div>';});}dd.innerHTML=dh;dd.classList.add('show');dd.dataset.activeDate=ds;}
    function rl(){var h='',cur='';if(!records.length){h='<div class="empty-state"><div class="empty-icon">💩</div><p>还没有排泄记录</p></div>';}records.forEach(function(r){if(r.date!==cur){if(cur)h+='</div>';h+='<div class="history-day"><h4>'+r.date+' '+Utils.formatDate(r.date).split(' ').pop()+'</h4>';cur=r.date;}var ti=CONFIG.EXCRETION_TYPES.find(function(t){return t.value===r.type;})||{},si=CONFIG.STOOL_CONSISTENCY.find(function(s){return s.value===r.stoolConsistency;})||{},qi=CONFIG.QUANTITY_LEVELS.find(function(q){return q.value===r.quantity;})||{};h+='<div class="excretion-card" style="display:flex;justify-content:space-between"><div style="display:flex;align-items:center;gap:8px"><span class="ex-icon">'+(ti.icon||'💩')+'</span><span class="ex-type">'+(ti.label||r.type)+'</span>';if(r.stoolConsistency)h+='<span style="font-size:11px;padding:2px 6px;border-radius:10px;background:'+(si.color||'#999')+'20;color:'+(si.color||'#999')+'">'+(si.label||r.stoolConsistency)+'</span>';if(r.quantity)h+='<span class="ex-meta">量:'+(qi.label||r.quantity)+'</span>';if(r.stoolColor)h+='<span class="ex-meta">颜色:'+Utils.escape(r.stoolColor)+'</span>';h+='</div><span style="display:flex;gap:4px;align-items:center">';if(r.note)h+='<span class="ex-meta">'+Utils.escape(r.note)+'</span>';h+='<button class="btn-sm btn-danger" data-action="delete-ex" data-id="'+r.id+'" style="font-size:10px;padding:2px 8px">✕</button></span></div>';});if(cur)h+='</div>';ld.innerHTML=h;}
    function rc(){var now=new Date(),cy=now.getFullYear(),cm=now.getMonth()+1;
    function rcc(){var h='<div class="calendar-nav"><button id="ex-cal-prev">◀</button><span class="cal-month-label">'+cy+'年'+cm+'月</span><button id="ex-cal-next">▶</button></div>';h+='<div class="calendar-grid">';['日','一','二','三','四','五','六'].forEach(function(d){h+='<div class="cal-day-header">'+d+'</div>';});var fd=new Date(cy,cm-1,1).getDay(),dim=new Date(cy,cm,0).getDate(),ts=Utils.todayStr();for(var i=0;i<fd;i++)h+='<div class="cal-day empty"></div>';for(var d=1;d<=dim;d++){var ds=cy+'-'+String(cm).padStart(2,'0')+'-'+String(d).padStart(2,'0');var de=records.filter(function(r){return r.date===ds;});var hasD=de.some(function(r){return r.stoolConsistency==='diarrhea';}),hasS=de.some(function(r){return r.stoolConsistency==='soft';}),hasN=de.some(function(r){return r.stoolConsistency==='normal'||(!r.stoolConsistency&&r.type!=='pee');}),isT=ds===ts,bg='';if(hasD)bg='background:#FFEBEE;';else if(hasS)bg='background:#FFF8E1;';else if(hasN||de.length>0)bg='background:#E8F5E9;';h+='<div class="cal-day'+(isT?' today':'')+'" data-date="'+ds+'" style="'+bg+'"><span class="cal-date">'+d+'</span>';if(de.length>0){h+='<div style="display:flex;gap:1px;flex-wrap:wrap;justify-content:center;margin-top:1px">';var hasPoop=de.some(function(r){return r.type==='poop'||r.type==='both';}),hasPee=de.some(function(r){return r.type==='pee'||r.type==='both';});if(hasD)h+='<span style="width:6px;height:6px;border-radius:50%;background:#E57373;display:inline-block"></span>';else if(hasS)h+='<span style="width:6px;height:6px;border-radius:50%;background:#FFD54F;display:inline-block"></span>';else if(hasPoop)h+='<span style="width:6px;height:6px;border-radius:50%;background:#81C784;display:inline-block"></span>';if(hasPee)h+='<span style="width:6px;height:6px;border-radius:50%;background:#90B4CE;display:inline-block;margin-left:1px"></span>';h+='</div>';}h+='</div>';}h+='</div>';cd.innerHTML=h;var pb=document.getElementById('ex-cal-prev'),nb=document.getElementById('ex-cal-next');if(pb)pb.onclick=function(){cm--;if(cm<1){cm=12;cy--;}rcc();};if(nb)nb.onclick=function(){cm++;if(cm>12){cm=1;cy++;}rcc();};cd.querySelectorAll('.cal-day:not(.empty)').forEach(function(day){day.onclick=function(){rd(this.dataset.date);};});}rcc();}
    rc();rl();rd(Utils.todayStr());
    lb.onclick=function(){lb.classList.add('active');cb.classList.remove('active');ld.style.display='';cd.style.display='none';rl();};
    cb.onclick=function(){cb.classList.add('active');lb.classList.remove('active');cd.style.display='';ld.style.display='none';rc();};
  },20);
  document.getElementById('feeding-sub-excretion').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;if(btn.dataset.action==='delete-ex'){UIRenderer._handleDelete('excretionRecords',btn.dataset.id,function(){UIRenderer.renderExcretion();UIRenderer.renderDashboard();});}else if(btn.dataset.action==='edit-ex'){var rec=records.find(function(r){return r.id===btn.dataset.id;});if(rec)UIRenderer._editExcretionRecord(rec);}};
};

UIRenderer._editExcretionRecord = function(rec) {
  var html='<form id="modal-form-edit-ex"><div class="form-row"><div class="form-group"><label>日期</label><input type="date" name="date" value="'+rec.date+'" required></div>';
  html+='<div class="form-group"><label>时段</label><select name="timeOfDay"><option value="morning"'+(rec.timeOfDay==='morning'?' selected':'')+'>☀️ 早上</option><option value="afternoon"'+(rec.timeOfDay==='afternoon'?' selected':'')+'>🌤️ 下午</option><option value="evening"'+(rec.timeOfDay==='evening'?' selected':'')+'>🌙 晚上</option></select></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>类型</label><select name="type">';CONFIG.EXCRETION_TYPES.forEach(function(t){html+='<option value="'+t.value+'"'+(rec.type===t.value?' selected':'')+'>'+t.label+'</option>';});html+='</select></div>';
  html+='<div class="form-group"><label>便便状态</label><select name="stoolConsistency"><option value="">未排便</option>';CONFIG.STOOL_CONSISTENCY.forEach(function(s){html+='<option value="'+s.value+'"'+(rec.stoolConsistency===s.value?' selected':'')+'>'+s.label+'</option>';});html+='</select></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>排便量</label><select name="quantity"><option value="">—</option>';CONFIG.QUANTITY_LEVELS.forEach(function(q){html+='<option value="'+q.value+'"'+(rec.quantity===q.value?' selected':'')+'>'+q.label+'</option>';});html+='</select></div>';
  html+='<div class="form-group"><label>颜色/外观</label><input type="text" name="stoolColor" value="'+Utils.escape(rec.stoolColor||'')+'"></div></div>';
  html+='<div class="form-group"><label>备注</label><textarea name="note">'+Utils.escape(rec.note||'')+'</textarea></div></form>';
  openModal('编辑排泄记录',html,function(){var fd=new FormData(document.getElementById('modal-form-edit-ex'));DataManager.updateRecord('excretionRecords',rec.id,{date:fd.get('date'),timeOfDay:fd.get('timeOfDay'),type:fd.get('type'),stoolConsistency:fd.get('stoolConsistency')||'',stoolColor:fd.get('stoolColor').trim(),quantity:fd.get('quantity')||'',note:fd.get('note')||''});closeModal();showToast('已更新','success');UIRenderer.renderExcretion();UIRenderer.renderDashboard();});
};

// ===== 5. 健康总览 =====
UIRenderer.renderHealthOverview = function() {
  var events=[];
  var vaccines=DataManager.getSection('vaccineRecords').sort(function(a,b){return a.date.localeCompare(b.date);});
  for(var i=0;i<vaccines.length;i++){var v=vaccines[i],intervalStr='';if(i>0){intervalStr='<span class="badge-next" style="background:#FFF0EB;color:#E65100;border:1px solid #FFD1A9">⏱ 距上针: '+daysBt(vaccines[i-1].date,v.date)+'天（推荐21-28天）</span>';}events.push({date:v.date,type:'vaccine',title:v.vaccineName+' 第'+v.doseNumber+'针',cost:v.cost,detail:v.hospital?'🏥 '+v.hospital:'',extra:intervalStr,color:'#FF8C69'});}
  DataManager.getSection('healthCheckRecords').forEach(function(h){events.push({date:h.date,type:'checkup',title:h.chiefComplaint||'体检',cost:h.totalCost,detail:h.hospital?'🏥 '+h.hospital:'',color:'#90B4CE'});});
  var deworms=(DataManager.getSection('dewormingRecords')||[]).sort(function(a,b){return a.date.localeCompare(b.date);});
  for(var j=0;j<deworms.length;j++){var dw=deworms[j],dInterval='';if(j>0){dInterval='<span class="badge-next" style="background:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9">⏱ 距上次: '+daysBt(deworms[j-1].date,dw.date)+'天（推荐30天）</span>';}events.push({date:dw.date,type:'deworming',title:dw.productName||'驱虫',cost:dw.cost||0,detail:dw.hospital?'🏥 '+dw.hospital:'',extra:dInterval,color:'#81C784'});}
  // Push medical before final sort so they're at end for same date
  (DataManager.getSection('medicalRecords')||[]).forEach(function(m){events.push({date:m.date,type:'zzz_medical',title:m.diagnosis||m.symptoms||'就医治疗',cost:m.totalCost||0,detail:'🏥 '+(m.hospital||''),extra:m.treatmentCycle?'<span style="font-size:11px;color:var(--color-text-muted)">周期: '+m.treatmentCycle+'</span>':'',color:'#E57373'});});
  events.sort(function(a,b){return b.date.localeCompare(a.date);});
  // Move medical after same-date checkups
  for(var ei=0;ei<events.length;ei++){if(events[ei].type==='zzz_medical'){for(var ej=ei-1;ej>=0;ej--){if(events[ej].date===events[ei].date&&events[ej].type!=='zzz_medical'){var med=events.splice(ei,1)[0];events.splice(ej+1,0,med);break;}}}}
  var healthEvents=DataManager.getSection('healthEvents')||[];
  var upcoming=healthEvents.filter(function(e){return !e.completed&&e.date>=Utils.todayStr();}).sort(function(a,b){return a.date.localeCompare(b.date);});
  var completedHe=healthEvents.filter(function(e){return e.completed;}).sort(function(a,b){return b.date.localeCompare(a.date);});
  var markedDates={};events.forEach(function(e){markedDates[e.date]=(markedDates[e.date]||[]);markedDates[e.date].push(e.type);});if(DataManager.getSection('healthCheckRecords').some(function(h){return h.id==='hc_1';})){markedDates['2026-06-11']=(markedDates['2026-06-11']||[]);markedDates['2026-06-11'].push('checkup');}healthEvents.forEach(function(e){markedDates[e.date]=(markedDates[e.date]||[]);markedDates[e.date].push('healthevent');});(DataManager.getSection('medicalRecords')||[]).forEach(function(m){var tc=m.treatmentCycle||'';var rng=tc.match(/(\d{4}-\d{2}-\d{2})\s*至\s*(\d{4}-\d{2}-\d{2})/);if(rng){var s=new Date(rng[1]+'T00:00:00'),e=new Date(rng[2]+'T00:00:00');while(s<=e){var ds=s.getFullYear()+'-'+String(s.getMonth()+1).padStart(2,'0')+'-'+String(s.getDate()).padStart(2,'0');if(ds!==m.date){markedDates[ds]=(markedDates[ds]||[]);markedDates[ds].push('zzz_medical');}s.setDate(s.getDate()+1);}}});

  var html='<div class="card-grid-2col">';
  html+='<div class="card"><h3>📅 健康日历</h3><div id="health-calendar-container"></div><div id="health-cal-detail" class="cal-day-detail" style="margin-top:8px"></div></div>';
  html+='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">📋 健康事项</h3><button class="btn-sm btn-outline" id="btn-add-health-event">+ 添加</button></div>';
  if(upcoming.length>0){upcoming.forEach(function(e){var dl=Utils.daysBetween(Utils.todayDate(),new Date(e.date+'T00:00:00'));html+='<div style="padding:8px 12px;border-radius:8px;margin-bottom:3px;background:'+(dl<=7?'#FFF8E1':'#E3F2FD')+';font-size:13px"><div style="display:flex;justify-content:space-between;align-items:center"><span>'+(dl<=7?'⚠️ ':'ℹ️ ')+'<strong>'+Utils.escape(e.title)+'</strong></span><span style="display:flex;gap:4px;flex-shrink:0"><button class="btn-sm btn-outline" data-action="edit-hev" data-id="'+e.date+'_'+encodeURIComponent(e.title)+'" style="font-size:10px;padding:2px 6px">✏️</button><button class="btn-sm btn-danger" data-action="delete-hev" data-id="'+e.date+'_'+encodeURIComponent(e.title)+'" style="font-size:10px;padding:2px 6px">✕</button></span></div><div style="font-size:11px;color:var(--color-text-muted);margin-top:2px">📅 '+e.date+'（还有'+dl+'天）</div></div>';});}else{html+='<p style="font-size:13px;color:var(--color-text-muted)">暂无</p>';}
  if(completedHe.length>0){html+='<div style="margin-top:8px;border-top:1px solid var(--color-card-border);padding-top:8px"><p style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px">✅ 已完成（'+completedHe.length+'）</p>';completedHe.slice(0,5).forEach(function(e){html+='<div class="alert-item success" style="margin-bottom:2px"><span style="text-decoration:line-through">'+Utils.escape(e.title)+' · '+e.date+'</span></div>';});html+='</div>';}
  html+='</div></div>';

  html+='<div class="card"><h3>📋 健康记录时间线 v5</h3><div class="timeline">';
  if(events.length===0)html+='<div class="empty-state"><p>还没有健康记录</p></div>';
  var rendered={};
  events.forEach(function(e,i){if(rendered[i])return;
    var pair=null;if(e.type==='checkup'){for(var j=i+1;j<events.length;j++){if(events[j].type==='zzz_medical'&&events[j].date===e.date&&!rendered[j]){pair=events[j];rendered[j]=true;break;}}}
    var icon=e.type==='vaccine'?'💉':'🩺';
    html+='<div class="timeline-item"><div class="timeline-dot" style="background:'+e.color+'">'+icon+'</div><div class="timeline-content" style="display:flex;gap:10px;flex-wrap:wrap">';
    html+='<div class="card" style="flex:1;min-width:200px"><div style="display:flex;justify-content:space-between;align-items:baseline"><h4 style="margin:0">'+Utils.escape(e.title)+'</h4>';if(e.cost)html+='<span style="font-size:13px;font-weight:600;color:var(--color-primary)">'+Utils.fmtMoney(e.cost)+'</span>';html+='</div><time>'+Utils.formatDate(e.date)+'</time>';if(e.detail)html+='<p>'+e.detail+'</p>';if(e.extra)html+=e.extra+'<br>';html+='</div>';
    if(pair){html+='<div class="card" style="flex:1;min-width:200px;border-left:3px solid #E57373"><div style="display:flex;justify-content:space-between;align-items:baseline"><h4 style="margin:0">💊 '+Utils.escape(pair.title)+'</h4>';if(pair.cost)html+='<span style="font-size:13px;font-weight:600;color:var(--color-primary)">'+Utils.fmtMoney(pair.cost)+'</span>';html+='</div><time>'+Utils.formatDate(pair.date)+'</time>';if(pair.detail)html+='<p>'+pair.detail+'</p>';if(pair.extra)html+=pair.extra+'<br>';html+='</div>';}
    html+='</div></div>';
  });
  html+='</div></div>';

  document.getElementById('health-sub-overview').innerHTML=html;
  document.getElementById('btn-add-health-event').onclick=function(){UIRenderer._showHealthEventForm(null);};
  document.getElementById('health-sub-overview').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;if(btn.dataset.action==='edit-hev'){var hev=healthEvents.find(function(x){return(x.date+'_'+encodeURIComponent(x.title))===btn.dataset.id;});if(hev)UIRenderer._showHealthEventForm(hev);}else if(btn.dataset.action==='delete-hev'){UIRenderer._handleDeleteHealthEvent(btn.dataset.id);}};

  setTimeout(function(){
    var cd=document.getElementById('health-calendar-container'),dd=document.getElementById('health-cal-detail');if(!cd)return;
    var now=new Date(),cy=now.getFullYear(),cm=now.getMonth()+1;
    function rc(){var typeClr={vaccine:'#FF8C69',checkup:'#90B4CE',deworming:'#81C784',medical:'#E57373',zzz_medical:'#E57373',healthevent:'#BA68C8'};
      var h='<div class="calendar-nav"><button id="hcal-prev">◀</button><span class="cal-month-label">'+cy+'年'+cm+'月</span><button id="hcal-next">▶</button></div>';h+='<div class="calendar-grid">';['日','一','二','三','四','五','六'].forEach(function(d){h+='<div class="cal-day-header">'+d+'</div>';});var fd=new Date(cy,cm-1,1).getDay(),dim=new Date(cy,cm,0).getDate(),ts=Utils.todayStr();for(var i=0;i<fd;i++)h+='<div class="cal-day empty"></div>';for(var d=1;d<=dim;d++){var ds=cy+'-'+String(cm).padStart(2,'0')+'-'+String(d).padStart(2,'0');var isT=ds===ts,mds=markedDates[ds]||[];h+='<div class="cal-day'+(isT?' today':'')+'" data-date="'+ds+'"><span class="cal-date">'+d+'</span>';if(mds.length>0){h+='<div class="cal-dots">';mds.forEach(function(t){h+='<span class="cal-dot" style="background:'+(typeClr[t]||'#BA68C8')+'"></span>';});h+='</div>';}h+='</div>';}h+='</div>';cd.innerHTML=h;document.getElementById('hcal-prev').onclick=function(){cm--;if(cm<1){cm=12;cy--;}rc();};document.getElementById('hcal-next').onclick=function(){cm++;if(cm>12){cm=1;cy++;}rc();};cd.querySelectorAll('.cal-day:not(.empty)').forEach(function(day){day.onclick=function(){var ds=this.dataset.date,dayEv=events.filter(function(e){return e.date===ds;}),dayHe=healthEvents.filter(function(e){return e.date===ds;});var dh='<h4>📅 '+Utils.formatDate(ds)+'</h4>';var inTreatment=[];(DataManager.getSection('medicalRecords')||[]).forEach(function(m){var tc=m.treatmentCycle||'';var rng=tc.match(/(\d{4}-\d{2}-\d{2})\s*至\s*(\d{4}-\d{2}-\d{2})/);if(rng){var sd=rng[1],ed=rng[2];if(ds>sd&&ds<ed)inTreatment.push({m:m,label:'（治疗中）'});else if(ds===ed)inTreatment.push({m:m,label:'（治疗结束）'});}});if(dayEv.length>0){dayEv.forEach(function(e){dh+='<div style="font-size:12px;padding:2px 0">'+(e.type==='vaccine'?'💉':e.type==='checkup'?'🩺':e.type==='zzz_medical'?'💊':'🪱')+' '+Utils.escape(e.title)+'</div>';});}if(dayHe.length>0){dayHe.forEach(function(e){dh+='<div style="font-size:12px;padding:2px 0;color:#BA68C8">📌 '+(e.completed?'<s>':'')+Utils.escape(e.title)+(e.completed?'</s>':'')+'</div>';});}inTreatment.forEach(function(t){dh+='<div style="font-size:12px;padding:2px 0">💊 '+(t.m.diagnosis||t.m.symptoms||'就医治疗')+t.label+'</div>';});if(!dayEv.length&&!dayHe.length&&!inTreatment.length){dh+='<p style="font-size:12px;color:var(--color-text-muted)">当天没有健康记录</p>';}dd.innerHTML=dh;dd.classList.add('show');};});}rc();
  },20);
};

UIRenderer._showHealthEventForm = function(existing) {
  var html='<form id="modal-form-hev"><div class="form-row"><div class="form-group"><label>类型</label><select name="type"><option value="体检"'+(existing&&existing.type==='体检'?' selected':'')+'>体检</option><option value="疫苗"'+(existing&&existing.type==='疫苗'?' selected':'')+'>疫苗</option><option value="驱虫"'+(existing&&existing.type==='驱虫'?' selected':'')+'>驱虫</option><option value="复查"'+(existing&&existing.type==='复查'?' selected':'')+'>复查</option><option value="其他"'+(existing&&existing.type==='其他'?' selected':'')+'>其他</option></select></div>';
  html+='<div class="form-group"><label>日期</label><input type="date" name="date" value="'+(existing?existing.date:Utils.todayStr())+'" required></div></div>';
  html+='<div class="form-group"><label>标题</label><input type="text" name="title" value="'+(existing?Utils.escape(existing.title||''):'')+'" required></div>';
  html+='<div class="form-group"><label>备注</label><input type="text" name="note" value="'+(existing?Utils.escape(existing.note||''):'')+'"></div>';
  html+='<div class="form-group"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" name="syncReminder"'+(existing?'':' checked')+'> 同步到提醒页面和看板</label></div></form>';
  var oldTitle=existing?existing.title:'',oldDate=existing?existing.date:'',oldNote=existing?existing.note||'':'';
  openModal((existing?'编辑':'添加')+'健康事项',html,function(){
    var fd=new FormData(document.getElementById('modal-form-hev')),data={type:fd.get('type'),date:fd.get('date'),title:fd.get('title').trim(),note:fd.get('note').trim()};if(!data.title){showToast('请输入标题','danger');return;}
    var hev=DataManager.getSection('healthEvents')||[];if(existing){var idx=hev.findIndex(function(x){return x.date===oldDate&&x.title===oldTitle;});if(idx!==-1)hev[idx]=data;}else{hev.push(data);}
    DataManager.data().healthEvents=hev;
    if(oldTitle&&fd.get('syncReminder')){var rems=DataManager.getSection('reminders');for(var k=rems.length-1;k>=0;k--){if(rems[k].title===oldTitle&&rems[k].date===oldDate&&rems[k].note===oldNote)rems.splice(k,1);}}
    if(fd.get('syncReminder')){DataManager.addRecord('reminders',{type:'checkup',title:data.title,date:data.date,repeatType:'none',repeatInterval:0,completed:false,completedDate:null,note:data.note||''});}
    DataManager._save();closeModal();showToast('已保存','success');UIRenderer.renderHealthOverview();UIRenderer.renderDashboard();Router.updateNavBadges();
  });
};

UIRenderer._handleDeleteHealthEvent = function(encodedId) {
  showConfirm('确定删除这个健康事项吗？').then(function(ok){if(!ok)return;var hev=DataManager.getSection('healthEvents')||[];var idx=hev.findIndex(function(x){return(x.date+'_'+encodeURIComponent(x.title))===encodedId;});if(idx===-1)return;var ev=hev[idx];var rems=DataManager.getSection('reminders');for(var k=rems.length-1;k>=0;k--){if(rems[k].title===ev.title&&rems[k].date===ev.date)rems.splice(k,1);}hev.splice(idx,1);DataManager._save();showToast('已删除','success');UIRenderer.renderHealthOverview();UIRenderer.renderDashboard();Router.updateNavBadges();});
};

// ===== 6. 驱虫 =====
UIRenderer.renderDeworming = function() {
  var records=[].concat(DataManager.getSection('dewormingRecords')||[]).sort(function(a,b){return b.date.localeCompare(a.date);});
  var html='<div class="timeline">';if(!records.length)html+='<div class="empty-state"><div class="empty-icon">🪱</div><p>还没有驱虫记录</p></div>';
  for(var i=0;i<records.length;i++){var r=records[i],intervalStr='';if(i<records.length-1){intervalStr='<span class="badge-next" style="background:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9">⏱ 距上次: '+daysBt(records[i+1].date,r.date)+'天（推荐30天）</span>';}
    html+='<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-content card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h4>'+Utils.escape(r.productName||'驱虫')+'</h4>';if(r.cost)html+='<span style="font-size:13px;font-weight:600;color:var(--color-primary)">'+Utils.fmtMoney(r.cost)+'</span>';html+='</div><time>'+Utils.formatDate(r.date)+'</time><p>🪱 类型: '+(r.type==='internal'?'体内驱虫':r.type==='external'?'体外驱虫':'体内外同驱')+'</p>';if(intervalStr)html+=intervalStr+'<br>';if(r.brand)html+='<p>🏷️ 品牌: '+Utils.escape(r.brand)+'</p>';if(r.hospital)html+='<p>🏥 '+Utils.escape(r.hospital)+'</p>';if(r.nextDueDate){var dl=Utils.daysBetween(Utils.todayDate(),new Date(r.nextDueDate+'T00:00:00'));html+='<span class="badge-next">📅 下次: '+r.nextDueDate+(dl>0?' (还有'+dl+'天)':'')+'</span>';}if(r.note)html+='<p style="margin-top:4px;font-size:12px;color:var(--color-text-muted)">📝 '+Utils.escape(r.note)+'</p>';html+='<div class="card-actions"><button class="btn-sm btn-outline" data-action="edit-dew" data-id="'+r.id+'">✏️</button><button class="btn-sm btn-danger" data-action="delete-dew" data-id="'+r.id+'">🗑️</button></div></div></div>';}
  html+='</div><button class="btn-add" id="btn-add-deworming">➕ 添加驱虫记录</button>';
  document.getElementById('health-sub-deworming').innerHTML=html;
  document.getElementById('health-sub-deworming').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;if(btn.dataset.action==='edit-dew')UIRenderer._showDewormingForm(records.find(function(x){return x.id===btn.dataset.id;}));else if(btn.dataset.action==='delete-dew')UIRenderer._handleDelete('dewormingRecords',btn.dataset.id,function(){UIRenderer.renderDeworming();});};
  document.getElementById('btn-add-deworming').onclick=function(){UIRenderer._showDewormingForm(null);};
};

UIRenderer._showDewormingForm = function(existing) {
  var html='<form id="modal-form-dew"><div class="form-row"><div class="form-group"><label>类型</label><select name="type"><option value="internal"'+(existing&&existing.type==='internal'?' selected':'')+'>体内驱虫</option><option value="external"'+(existing&&existing.type==='external'?' selected':'')+'>体外驱虫</option><option value="internal_external"'+(existing&&existing.type==='internal_external'?' selected':'')+'>体内外同驱</option></select></div>';
  html+='<div class="form-group"><label>产品名称</label><input type="text" name="productName" value="'+(existing?Utils.escape(existing.productName||''):'')+'" required></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>日期</label><input type="date" name="date" value="'+(existing?existing.date:Utils.todayStr())+'" required></div><div class="form-group"><label>下次驱虫</label><input type="date" name="nextDueDate" value="'+(existing&&existing.nextDueDate?existing.nextDueDate:'')+'"></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>品牌</label><input type="text" name="brand" value="'+(existing?Utils.escape(existing.brand||''):'')+'"></div><div class="form-group"><label>费用(元)</label><input type="number" name="cost" step="0.01" value="'+(existing?existing.cost||'':'')+'"></div></div>';
  html+='<div class="form-group"><label>医院</label><input type="text" name="hospital" value="'+(existing?Utils.escape(existing.hospital||''):'')+'"></div><div class="form-group"><label>备注</label><input type="text" name="note" value="'+(existing?Utils.escape(existing.note||''):'')+'"></div></form>';
  openModal((existing?'编辑':'添加')+'驱虫记录',html,function(){var fd=new FormData(document.getElementById('modal-form-dew'));var d={type:fd.get('type'),productName:fd.get('productName').trim(),date:fd.get('date'),nextDueDate:fd.get('nextDueDate')||null,brand:fd.get('brand').trim(),hospital:fd.get('hospital').trim(),cost:parseFloat(fd.get('cost'))||0,note:fd.get('note').trim()};if(!d.productName){showToast('请输入产品名称','danger');return;}if(existing)DataManager.updateRecord('dewormingRecords',existing.id,d);else DataManager.addRecord('dewormingRecords',d);closeModal();showToast('已保存','success');UIRenderer.renderDeworming();UIRenderer.renderDashboard();});
};

// ===== 7. 成长手记 =====
UIRenderer.renderDiary = function() {
  var entries=[].concat(DataManager.getSection('growthDiary')).sort(function(a,b){return b.date.localeCompare(a.date);});
  var html='';if(!entries.length)html+='<div class="empty-state"><div class="empty-icon">📖</div><p>还没有成长手记~</p></div>';
  entries.forEach(function(e){html+='<div class="timeline-item"><div class="timeline-dot">🐱</div><div class="timeline-content card"><h4>'+Utils.escape(e.title)+'</h4><time>'+Utils.formatDate(e.date)+'</time>';if(e.category)html+='<span class="badge" style="font-size:10px;margin-top:4px">'+Utils.escape(e.category)+'</span>';html+='<p style="margin-top:6px;white-space:pre-wrap">'+Utils.escape(e.content)+'</p>';if(e.mood)html+='<p style="font-size:12px;margin-top:4px">😊 心情: '+Utils.escape(e.mood)+'</p>';if(e.activity)html+='<p style="font-size:12px">⚡ 活跃度: '+Utils.escape(e.activity)+'</p>';if(e.photos&&e.photos.length>0){html+='<div class="diary-photos">';e.photos.forEach(function(p){html+='<img src="'+p+'" class="diary-thumb" onclick="UIRenderer._showPhoto(\''+p+'\')">';});html+='</div>';}html+='<div class="card-actions"><button class="btn-sm btn-outline" data-action="edit-diary" data-id="'+e.id+'">✏️</button><button class="btn-sm btn-danger" data-action="delete-diary" data-id="'+e.id+'">🗑️</button></div></div></div>';});
  document.getElementById('diary-timeline').innerHTML=html;
  document.getElementById('view-diary').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;if(btn.dataset.action==='edit-diary')UIRenderer._showGrowthJournalForm(entries.find(function(x){return x.id===btn.dataset.id;}));else if(btn.dataset.action==='delete-diary')UIRenderer._handleDelete('growthDiary',btn.dataset.id,function(){UIRenderer.renderDiary();});};
  document.getElementById('btn-add-diary').onclick=function(){UIRenderer._showGrowthJournalForm(null);};
};

UIRenderer._showGrowthJournalForm = function(existing) {
  var cats=['饲养心得','行为记录','技能训练','日常趣事','健康状况','其他'],moods=['😊 开心','😴 困倦','😾 不满','🤪 调皮','😌 惬意','😰 紧张'],acts=['⚡⚡⚡ 非常活跃','⚡⚡ 适中','⚡ 较安静','💤 嗜睡'];
  var html='<form id="modal-form-diary"><div class="form-row"><div class="form-group"><label>日期</label><input type="date" name="date" value="'+(existing?existing.date:Utils.todayStr())+'" required></div>';
  html+='<div class="form-group"><label>分类</label><select name="category">';cats.forEach(function(c){html+='<option value="'+c+'"'+(existing&&existing.category===c?' selected':'')+'>'+c+'</option>';});html+='</select></div></div>';
  html+='<div class="form-group"><label>标题</label><input type="text" name="title" value="'+(existing?Utils.escape(existing.title):'')+'" required></div>';
  html+='<div class="form-group"><label>内容</label><textarea name="content" style="min-height:120px">'+(existing?Utils.escape(existing.content):'')+'</textarea></div>';
  html+='<div class="form-row"><div class="form-group"><label>心情</label><select name="mood"><option value="">—</option>';moods.forEach(function(m){html+='<option value="'+m+'"'+(existing&&existing.mood===m?' selected':'')+'>'+m+'</option>';});html+='</select></div>';
  html+='<div class="form-group"><label>活跃度</label><select name="activity"><option value="">—</option>';acts.forEach(function(a){html+='<option value="'+a+'"'+(existing&&existing.activity===a?' selected':'')+'>'+a+'</option>';});html+='</select></div></div>';
  html+='<div class="form-group"><label>照片<small style="font-weight:400;color:var(--color-text-muted)">（可选）</small></label><div id="diary-photos-preview">';if(existing&&existing.photos){existing.photos.forEach(function(p){html+='<div style="display:inline-block;position:relative;margin:4px"><img src="'+p+'" style="width:60px;height:60px;object-fit:cover;border-radius:6px"><button type="button" class="btn-remove" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;font-size:12px;background:var(--color-card);border-radius:50%" onclick="this.parentElement.remove()">✕</button></div>';});}html+='</div><button type="button" class="btn-outline" id="btn-pick-photos" style="margin-top:6px">📷 选择照片</button></div></form>';
  html+='<input type="hidden" id="diary-kept-photos" value="'+(existing&&existing.photos?Utils.escape(JSON.stringify(existing.photos)):'[]')+'">';
  openModal((existing?'编辑':'写')+'成长手记',html,function(){var fd=new FormData(document.getElementById('modal-form-diary'));var photos=[];try{photos=JSON.parse(document.getElementById('diary-kept-photos').value||'[]');}catch(e){}document.querySelectorAll('#modal-body #diary-photos-preview img').forEach(function(img){if(photos.indexOf(img.src)===-1)photos.push(img.src);});var data={date:fd.get('date'),category:fd.get('category'),title:fd.get('title').trim(),content:fd.get('content').trim(),mood:fd.get('mood')||'',activity:fd.get('activity')||'',photos:photos};if(!data.title){showToast('请输入标题','danger');return;}if(existing)DataManager.updateRecord('growthDiary',existing.id,data);else DataManager.addRecord('growthDiary',data);closeModal();showToast('已保存','success');UIRenderer.renderDiary();});
  document.getElementById('btn-pick-photos').onclick=function(){document.getElementById('hidden-photo-input').click();};document.getElementById('hidden-photo-input').dataset.target='diary-photos-preview';
};

// ===== 8. 猫咪信息 =====
UIRenderer._showCatInfoForm = function() {
  var cat=DataManager.data().catInfo;
  var html='<form id="modal-form-cat"><div style="text-align:center;margin-bottom:16px"><div class="cat-avatar-large" style="margin:0 auto;cursor:pointer" id="modal-cat-avatar">'+(cat.photo?'<img src="'+cat.photo+'" alt="">':'🐱')+'</div><p style="font-size:11px;color:var(--color-text-muted);margin-top:4px">点击更换头像</p></div>';
  html+='<div class="form-row"><div class="form-group"><label>名字</label><input type="text" name="name" value="'+Utils.escape(cat.name)+'" required></div><div class="form-group"><label>品种</label><input type="text" name="breed" value="'+Utils.escape(cat.breed)+'"></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>生日</label><input type="date" name="birthDate" value="'+cat.birthDate+'"></div><div class="form-group"><label>到家日期</label><input type="date" name="adoptionDate" value="'+cat.adoptionDate+'"></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>性别</label><select name="gender"><option value="female"'+(cat.gender==='female'?' selected':'')+'>♀ 妹妹</option><option value="male"'+(cat.gender==='male'?' selected':'')+'>♂ 弟弟</option></select></div><div class="form-group"><label>绝育</label><select name="fixed"><option value="0"'+(cat.fixed?'':' selected')+'>未绝育</option><option value="1"'+(cat.fixed?' selected':'')+'>已绝育</option></select></div></div>';
  html+='<div class="form-group"><label>花色</label><input type="text" name="color" value="'+Utils.escape(cat.color||'')+'"></div><div class="form-group"><label>居住地</label><input type="text" name="location" value="'+Utils.escape(cat.location||'')+'"></div>';
  html+='<div class="form-group"><label>每日补充品</label><textarea name="dailySupplements" style="min-height:50px">'+Utils.escape(cat.dailySupplements||'')+'</textarea></div>';
  html+='<div class="form-group"><label>健康备忘</label><textarea name="healthNotes" style="min-height:80px">'+Utils.escape(cat.healthNotes||'')+'</textarea></div></form>';
  openModal('编辑猫咪信息',html,function(){var fd=new FormData(document.getElementById('modal-form-cat'));DataManager.updateCatInfo({name:fd.get('name').trim(),breed:fd.get('breed').trim(),birthDate:fd.get('birthDate'),adoptionDate:fd.get('adoptionDate'),gender:fd.get('gender'),fixed:fd.get('fixed')==='1',color:fd.get('color').trim(),location:fd.get('location').trim(),dailySupplements:fd.get('dailySupplements').trim(),healthNotes:fd.get('healthNotes').trim()});closeModal();showToast('已更新','success');UIRenderer.renderDashboard();});
  document.getElementById('modal-cat-avatar').onclick=function(){document.getElementById('hidden-avatar-input').click();};
};

// ===== 9. 体检/就医（统一表单，同天合并展示） =====
UIRenderer.renderCheckup = function() {
  var hc=[].concat(DataManager.getSection('healthCheckRecords')).sort(function(a,b){return b.date.localeCompare(a.date);});
  var med=[].concat(DataManager.getSection('medicalRecords')||[]).sort(function(a,b){return b.date.localeCompare(a.date);});
  var merged=[],used={};
  hc.forEach(function(r){var g={date:r.date,hospital:r.hospital||'',hc:r,med:null,total:r.totalCost||0};var m=med.find(function(x){return !used[x.id]&&x.date===r.date&&(x.hospital||'')===(r.hospital||'');});if(m){g.med=m;g.total+=m.totalCost||0;used[m.id]=true;}merged.push(g);});
  med.forEach(function(m){if(!used[m.id])merged.push({date:m.date,hospital:m.hospital||'',hc:null,med:m,total:m.totalCost||0});});
  merged.sort(function(a,b){return b.date.localeCompare(a.date);});
  var html='<div class="timeline">';if(!merged.length)html+='<div class="empty-state"><div class="empty-icon">🩺</div><p>还没有体检/就医记录</p></div>';
  merged.forEach(function(g){var r=g.hc,m=g.med;
    html+='<div class="timeline-item"><div class="timeline-dot">'+(r&&m?'🩺':r?'🩺':'💊')+'</div><div class="timeline-content card"><div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap"><h4 style="margin:0">'+(r&&m?'🩺💊 体检+就医':r?'🩺 体检':'💊 就医')+(r&&r.chiefComplaint?' · '+Utils.escape(r.chiefComplaint):m&&m.diagnosis?' · '+Utils.escape(m.diagnosis):'')+'</h4><span style="font-weight:600;color:var(--color-primary)">'+Utils.fmtMoney(g.total)+'</span></div><time>'+Utils.formatDate(g.date)+'</time>';
    html+='<p style="font-size:13px;color:var(--color-text-secondary)">🏥 '+Utils.escape(g.hospital)+'</p>';
    if(r){if(r.weight)html+='<p style="font-size:12px;color:var(--color-text-muted)">⚖️ 体重: '+r.weight+'kg</p>';if(r.examinationItems&&r.examinationItems.length>0){html+='<table class="data-table" style="margin-top:4px"><thead><tr><th>项目</th><th>结果</th><th>参考值</th><th>费用</th></tr></thead><tbody>';r.examinationItems.forEach(function(ex){html+='<tr><td>'+Utils.escape(ex.name)+'</td><td style="font-weight:'+(ex.isAbnormal?'bold;color:var(--color-danger)':'')+'">'+(ex.result||'')+' '+(ex.unit||'')+'</td><td style="font-size:11px;color:var(--color-text-muted)">'+(ex.referenceRange||'')+'</td><td>'+(ex.cost?Utils.fmtMoney(ex.cost):'')+'</td></tr>';});html+='</tbody></table>';}if(r.note)html+='<p style="font-size:12px;color:var(--color-text-muted);margin-top:4px">📝 '+Utils.escape(r.note)+'</p>';}
    if(m){if(r)html+='<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--color-primary)"><span style="font-size:11px;color:var(--color-primary);font-weight:600">⬆ 同天就医</span>';if(m.symptoms)html+='<p style="font-size:12px;color:var(--color-text-secondary);margin-top:2px">🤒 症状: '+Utils.escape(m.symptoms)+'</p>';if(m.treatmentCycle)html+='<p style="font-size:12px;color:var(--color-text-secondary)">💉 治疗周期: '+Utils.escape(m.treatmentCycle)+'</p>';if(m.examinationItems&&m.examinationItems.length>0){html+='<table class="data-table" style="margin-top:4px"><thead><tr><th>就医检查项目</th><th>结果</th><th>参考值</th><th>费用</th></tr></thead><tbody>';m.examinationItems.forEach(function(ex){html+='<tr><td>'+Utils.escape(ex.name)+'</td><td style="font-weight:'+(ex.isAbnormal?'bold;color:var(--color-danger)':'')+'">'+(ex.result||'')+' '+(ex.unit||'')+'</td><td style="font-size:11px;color:var(--color-text-muted)">'+(ex.referenceRange||'')+'</td><td>'+(ex.cost?Utils.fmtMoney(ex.cost):'')+'</td></tr>';});html+='</tbody></table>';}if(m.medicineItems&&m.medicineItems.length>0){html+='<table class="data-table" style="margin-top:4px"><thead><tr><th>药品名称</th><th>用法用量</th><th>费用</th></tr></thead><tbody>';var mc=0;m.medicineItems.forEach(function(mi){html+='<tr><td>'+Utils.escape(mi.name)+'</td><td>'+(mi.dosage||'')+'</td><td>'+Utils.fmtMoney(mi.cost||0)+'</td></tr>';mc+=mi.cost||0;});html+='<tfoot><tr><td colspan="2" style="text-align:right;font-weight:600">合计</td><td style="font-weight:600;color:var(--color-primary)">'+Utils.fmtMoney(mc)+'</td></tr></tfoot></tbody></table>';}if(m.insuranceReimbursement)html+='<p style="font-size:12px;color:var(--color-success)">🏦 报销 '+Utils.fmtMoney(m.insuranceReimbursement)+' ('+(m.insuranceReimbursementPct||0)+'%) · 实付 '+Utils.fmtMoney((m.totalCost||0)-(m.insuranceReimbursement||0))+'</p>';if(m.followUpDate)html+='<span class="badge-next" style="background:#FFF3E0;color:#E65100;border:1px solid #FFCC80">📅 复诊: '+m.followUpDate+'</span> ';if(m.note)html+='<p style="font-size:12px;color:var(--color-text-muted)">📝 '+Utils.escape(m.note)+'</p>';if(r)html+='</div>';}
    html+='<div class="card-actions"><button class="btn-sm btn-outline" data-action="edit-unified" data-hc-id="'+(r?r.id:'')+'" data-med-id="'+(m?m.id:'')+'" data-date="'+g.date+'" data-hospital="'+Utils.escape(g.hospital||'')+'">✏️ 编辑</button><button class="btn-sm btn-danger" data-action="delete-unified" data-hc-id="'+(r?r.id:'')+'" data-med-id="'+(m?m.id:'')+'">🗑️ 删除</button></div></div></div>';
  });
  html+='</div><button class="btn-add" id="btn-add-checkup" style="margin-top:12px">➕ 添加体检/就医记录</button>';
  document.getElementById('health-sub-checkup').innerHTML=html;
  document.getElementById('health-sub-checkup').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;
    if(btn.dataset.action==='edit-unified'){var hcId=btn.dataset.hcId,medId=btn.dataset.medId;var existing={};if(hcId){var hcRec=DataManager.getSection('healthCheckRecords').find(function(x){return x.id===hcId;});if(hcRec)Object.assign(existing,hcRec);}if(medId){var medRec=(DataManager.getSection('medicalRecords')||[]).find(function(x){return x.id===medId;});if(medRec){existing._isMedical=true;existing._medId=medRec.id;existing.med_symptoms=medRec.symptoms||'';existing.med_diagnosis=medRec.diagnosis||'';existing.med_treatmentCycle=medRec.treatmentCycle||'';var tc=medRec.treatmentCycle||'';var m=tc.match(/(\d{4}-\d{2}-\d{2})\s*至\s*(\d{4}-\d{2}-\d{2})/);if(m){existing.med_startDate=m[1];existing.med_endDate=m[2];}existing.med_medicineItems=medRec.medicineItems||[];existing.med_examinationItems=medRec.examinationItems||[];existing.med_insuranceReimbursement=medRec.insuranceReimbursement||'';existing.med_insuranceReimbursementPct=medRec.insuranceReimbursementPct||'';existing.med_followUpDate=medRec.followUpDate||'';}}UIRenderer._showCheckupForm(Object.keys(existing).length>0?existing:null);}
    else if(btn.dataset.action==='delete-unified'){showConfirm('确定删除这条记录吗？').then(function(ok){if(!ok)return;if(btn.dataset.hcId)DataManager.deleteRecord('healthCheckRecords',btn.dataset.hcId);if(btn.dataset.medId)DataManager.deleteRecord('medicalRecords',btn.dataset.medId);showToast('已删除','success');UIRenderer.renderCheckup();UIRenderer.renderDashboard();});}
  };
  document.getElementById('btn-add-checkup').onclick=function(){UIRenderer._showCheckupForm(null);};
};

UIRenderer.renderMedical = function() {}; // deprecated

// Unified checkup form
UIRenderer._showCheckupForm = function(existing) {
  var html='<form id="modal-form-hc"><div class="form-row"><div class="form-group"><label>日期</label><input type="date" name="date" value="'+(existing?existing.date:Utils.todayStr())+'" required></div>';
  html+='<div class="form-group"><label>类型</label><select name="type"><option value="routine"'+(existing&&existing.type==='routine'?' selected':'')+'>常规体检</option><option value="emergency"'+(existing&&existing.type==='emergency'?' selected':'')+'>急诊</option><option value="follow-up"'+(existing&&existing.type==='follow-up'?' selected':'')+'>复查</option></select></div></div>';
  html+='<div class="form-row"><div class="form-group"><label>医院</label><input type="text" name="hospital" value="'+(existing?Utils.escape(existing.hospital||''):'')+'" required></div>';
  html+='<div class="form-group"><label>体重(kg)</label><input type="number" name="weight" step="0.01" value="'+(existing&&existing.weight?existing.weight:'')+'"></div></div>';
  html+='<div class="form-group"><label>主诉</label><input type="text" name="chiefComplaint" value="'+(existing?Utils.escape(existing.chiefComplaint||''):'')+'"></div>';
  html+='<div class="form-group"><label>检查项目</label><div id="exam-items"></div><button type="button" class="btn-outline" id="btn-add-exam" style="margin-top:6px">+ 添加检查项目</button></div>';
  html+='<div class="form-row"><div class="form-group"><label>体检费用(元)</label><input type="number" name="totalCost" id="hc-total-cost" step="0.01" value="'+(existing?existing.totalCost:'')+'" readonly style="background:#FFF0EB;font-weight:600"></div></div>';
  html+='<div class="form-group"><label>备注</label><textarea name="note">'+(existing?Utils.escape(existing.note||''):'')+'</textarea></div>';
  var isMedical=existing&&existing._isMedical;
  html+='<div style="margin-top:12px;padding-top:12px;border-top:2px dashed var(--color-primary)"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;font-size:14px"><input type="checkbox" id="chk-is-medical" name="isMedical"'+(isMedical?' checked':'')+' onchange="var m=document.getElementById(\'med-extra-fields\');m.style.display=this.checked?\'\':\'none\'"> 🏥 是否就医（含治疗/用药）</label>';
  html+='<div id="med-extra-fields" style="display:'+(isMedical?'':'none')+'">';
  html+='<div class="form-group" style="margin-top:8px"><label>症状</label><input type="text" name="med_symptoms" value="'+(existing?Utils.escape(existing.med_symptoms||''):'')+'"></div>';
  html+='<div class="form-group"><label>诊断</label><input type="text" name="med_diagnosis" value="'+(existing?Utils.escape(existing.med_diagnosis||''):'')+'"></div>';
  html+='<div class="form-row"><div class="form-group"><label>治疗开始</label><input type="date" id="med-start-date" name="med_startDate" onchange="var s=document.getElementById(\'med-start-date\').value,e=document.getElementById(\'med-end-date\').value,el=document.getElementById(\'med-days\');if(s&&e){var d=Math.round((new Date(e+\'T00:00:00\')-new Date(s+\'T00:00:00\'))/86400000)+1;el.textContent=\'共\'+d+\'天\';}" value="'+(existing&&existing.med_startDate?existing.med_startDate:'')+'"></div><div class="form-group"><label>治疗结束</label><input type="date" id="med-end-date" name="med_endDate" onchange="var s=document.getElementById(\'med-start-date\').value,e=document.getElementById(\'med-end-date\').value,el=document.getElementById(\'med-days\');if(s&&e){var d=Math.round((new Date(e+\'T00:00:00\')-new Date(s+\'T00:00:00\'))/86400000)+1;el.textContent=\'共\'+d+\'天\';}" value="'+(existing&&existing.med_endDate?existing.med_endDate:'')+'"></div><span id="med-days" style="font-size:12px;color:var(--color-primary);font-weight:600"></span></div>';
  html+='<div class="form-group"><label>就医检查项目</label><div id="med-exam-items"></div><button type="button" class="btn-outline" id="btn-add-med-exam" style="margin-top:6px">+ 添加检查项目</button></div>';
  html+='<div class="form-group"><label>药品及费用</label><div id="med-med-items"></div><button type="button" class="btn-outline" id="btn-add-med-med" style="margin-top:6px">+ 添加药品</button></div>';
  html+='<div class="form-group"><label>就医总费用(元) <small style="font-weight:400;color:var(--color-primary)">自动计算</small></label><input type="number" id="med-sub-total" value="0" readonly style="background:#FFF0EB;font-weight:600"></div>';
  html+='<div class="form-row"><div class="form-group"><label>保险报销(元)</label><input type="number" name="med_insuranceReimbursement" step="0.01" value="'+(existing?existing.med_insuranceReimbursement||'':'')+'"></div><div class="form-group"><label>报销比例(%)</label><input type="number" name="med_insuranceReimbursementPct" step="0.1" value="'+(existing?existing.med_insuranceReimbursementPct||'':'')+'"></div></div>';
  html+='<div class="form-group"><label>复诊日期</label><input type="date" name="med_followUpDate" value="'+(existing&&existing.med_followUpDate?existing.med_followUpDate:'')+'"></div>';
  html+='<div style="background:#FFF0EB;padding:8px 12px;border-radius:8px;text-align:center;font-weight:700;color:var(--color-primary);font-size:15px">💰 体检+就医总费用：¥<span id="combined-total">0</span></div>';
  html+='</div></div></form>';

  openModal((existing?'编辑':'添加')+'体检/就医记录',html,function(){
    var fd=new FormData(document.getElementById('modal-form-hc'));
    var examItems=[];document.querySelectorAll('#modal-body #exam-items .exam-item-row').forEach(function(row){var n=row.querySelector('[name="examName"]').value.trim(),r=row.querySelector('[name="examResult"]').value,u=row.querySelector('[name="examUnit"]').value,ref=row.querySelector('[name="examRef"]').value,c=parseFloat(row.querySelector('[name="examCost"]').value)||0,ab=row.querySelector('[name="examAbnormal"]').checked;if(n)examItems.push({name:n,result:r,unit:u,referenceRange:ref,isAbnormal:ab,cost:c});});
    var hcData={date:fd.get('date'),type:fd.get('type'),hospital:fd.get('hospital').trim(),chiefComplaint:fd.get('chiefComplaint').trim(),weight:fd.get('weight')?parseFloat(fd.get('weight')):null,examinationItems:examItems,totalCost:parseFloat(fd.get('totalCost'))||0,note:fd.get('note').trim()};
    if(!hcData.hospital){showToast('请输入医院名称','danger');return;}
    if(existing&&existing.id){DataManager.deleteRecord('healthCheckRecords',existing.id);}
    DataManager.addRecord('healthCheckRecords',hcData);
    if(fd.get('isMedical')){
      var mi=[];document.querySelectorAll('#modal-body .med-med-row').forEach(function(row){var n=row.querySelector('[name="medName"]').value.trim(),d=row.querySelector('[name="medDosage"]').value.trim(),c=parseFloat(row.querySelector('[name="medCost"]').value)||0;if(n)mi.push({name:n,dosage:d,cost:c});});
      var medExamItems=[];medExamData.forEach(function(ex){if(ex.name)medExamItems.push(ex);});
      var mtc=0;mi.forEach(function(m){mtc+=m.cost||0;});medExamItems.forEach(function(ex){mtc+=ex.cost||0;});
      var ins=parseFloat(fd.get('med_insuranceReimbursement'))||0;
      var medData={date:fd.get('date'),hospital:fd.get('hospital').trim(),symptoms:fd.get('med_symptoms').trim(),diagnosis:fd.get('med_diagnosis').trim(),treatmentCycle:(function(){var sd=fd.get('med_startDate'),ed=fd.get('med_endDate');if(sd&&ed){var days=Math.round((new Date(ed+'T00:00:00')-new Date(sd+'T00:00:00'))/86400000)+1;return sd+' 至 '+ed+'（共'+days+'天）';}return '';})(),examinationItems:medExamItems,medicineItems:mi,totalCost:mtc,insuranceReimbursement:ins,insuranceReimbursementPct:parseFloat(fd.get('med_insuranceReimbursementPct'))||0,actualCost:mtc-ins,followUpDate:fd.get('med_followUpDate')||null,note:''};
      if(existing&&existing._isMedical&&existing._medId){DataManager.deleteRecord('medicalRecords',existing._medId);}
      DataManager.addRecord('medicalRecords',medData);
    } else if(existing&&existing._isMedical&&existing._medId){DataManager.deleteRecord('medicalRecords',existing._medId);}
    closeModal();showToast('已保存','success');UIRenderer.renderCheckup();UIRenderer.renderDashboard();
  });

  // Add checkup exam row
  var addExamRow=function(){var row=document.createElement('div');row.className='exam-item-row';var ni=document.createElement('input');ni.type='text';ni.name='examName';ni.placeholder='项目名';ni.style.flex='2';row.appendChild(ni);var ri=document.createElement('input');ri.type='text';ri.name='examResult';ri.placeholder='结果';row.appendChild(ri);var ui=document.createElement('input');ui.type='text';ui.name='examUnit';ui.placeholder='单位';ui.style.maxWidth='50px';row.appendChild(ui);var refi=document.createElement('input');refi.type='text';refi.name='examRef';refi.placeholder='参考值';refi.style.cssText='max-width:80px;font-size:12px';row.appendChild(refi);var ci=document.createElement('input');ci.type='number';ci.name='examCost';ci.placeholder='费用';ci.step='0.01';ci.style.maxWidth='60px';ci.oninput=function(){var t=0;document.querySelectorAll('#modal-body #exam-items .exam-item-row [name="examCost"]').forEach(function(el){t+=parseFloat(el.value)||0;});var tc=document.getElementById('hc-total-cost');if(tc)tc.value=t.toFixed(2);var hc=t,med=parseFloat(document.getElementById('med-sub-total')?document.getElementById('med-sub-total').value:'0')||0;var ct=document.getElementById('combined-total');if(ct)ct.textContent=(hc+med).toFixed(2);};row.appendChild(ci);var lb=document.createElement('label');lb.style.cssText='font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:2px';var cb=document.createElement('input');cb.type='checkbox';cb.name='examAbnormal';lb.appendChild(cb);lb.appendChild(document.createTextNode('异常'));row.appendChild(lb);var rm=document.createElement('button');rm.type='button';rm.className='btn-remove';rm.textContent='✕';rm.onclick=function(){row.remove();var t=0;document.querySelectorAll('#modal-body #exam-items .exam-item-row [name="examCost"]').forEach(function(el){t+=parseFloat(el.value)||0;});var tc=document.getElementById('hc-total-cost');if(tc)tc.value=t.toFixed(2);};row.appendChild(rm);document.getElementById('exam-items').appendChild(row);};
  if(existing&&existing.examinationItems){existing.examinationItems.forEach(function(ex,i){addExamRow();var row=document.getElementById('exam-items').lastChild;row.querySelector('[name="examName"]').value=ex.name||'';row.querySelector('[name="examResult"]').value=ex.result||'';row.querySelector('[name="examUnit"]').value=ex.unit||'';row.querySelector('[name="examRef"]').value=ex.referenceRange||'';row.querySelector('[name="examCost"]').value=ex.cost||'';row.querySelector('[name="examAbnormal"]').checked=ex.isAbnormal||false;});}else{addExamRow();}
  document.getElementById('btn-add-exam').onclick=addExamRow;

  // Med exam rows (JS array synced)
  var medExamData=[];
  var addMedExamRow=function(ex){ex=ex||{};var idx=medExamData.length;medExamData.push(ex);var row=document.createElement('div');row.className='exam-item-row';var ni=document.createElement('input');ni.type='text';ni.name='examName';ni.placeholder='项目名';ni.style.flex='2';ni.value=ex.name||'';ni.oninput=function(){medExamData[idx].name=this.value;};row.appendChild(ni);var ri=document.createElement('input');ri.type='text';ri.name='examResult';ri.placeholder='结果';ri.value=ex.result||'';ri.oninput=function(){medExamData[idx].result=this.value;};row.appendChild(ri);var ui=document.createElement('input');ui.type='text';ui.name='examUnit';ui.placeholder='单位';ui.style.maxWidth='50px';ui.value=ex.unit||'';ui.oninput=function(){medExamData[idx].unit=this.value;};row.appendChild(ui);var refi=document.createElement('input');refi.type='text';refi.name='examRef';refi.placeholder='参考值';refi.style.cssText='max-width:80px;font-size:12px';refi.value=ex.referenceRange||'';refi.oninput=function(){medExamData[idx].referenceRange=this.value;};row.appendChild(refi);var ci=document.createElement('input');ci.type='number';ci.name='examCost';ci.placeholder='费用';ci.step='0.01';ci.style.maxWidth='60px';ci.value=ex.cost||'';ci.oninput=function(){var v=parseFloat(this.value);medExamData[idx].cost=isNaN(v)?0:v;updateMedSubTotal();};row.appendChild(ci);var lb=document.createElement('label');lb.style.cssText='font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:2px';var cb=document.createElement('input');cb.type='checkbox';cb.name='examAbnormal';cb.checked=ex.isAbnormal||false;cb.onchange=function(){medExamData[idx].isAbnormal=this.checked;};lb.appendChild(cb);lb.appendChild(document.createTextNode('异常'));row.appendChild(lb);var rm=document.createElement('button');rm.type='button';rm.className='btn-remove';rm.textContent='✕';rm.onclick=function(){row.remove();var n=ni.value,r=ri.value;for(var i=medExamData.length-1;i>=0;i--){if(medExamData[i].name===n&&medExamData[i].result===r){medExamData.splice(i,1);break;}}updateMedSubTotal();};row.appendChild(rm);var el=document.querySelector('#modal-body #med-exam-items');if(el)el.appendChild(row);};
  if(existing&&existing.med_examinationItems){existing.med_examinationItems.forEach(function(ex){addMedExamRow(ex);});}
  function calcNow(){updateMedSubTotal();var s=document.getElementById('med-start-date'),e=document.getElementById('med-end-date'),el=document.getElementById('med-days');if(s&&e&&s.value&&e.value&&el){var d=Math.round((new Date(e.value+'T00:00:00')-new Date(s.value+'T00:00:00'))/86400000)+1;el.textContent='共'+d+'天';}}
  if(document.getElementById('chk-is-medical')&&document.getElementById('chk-is-medical').checked){calcNow();}
  if(document.getElementById('btn-add-med-exam'))document.getElementById('btn-add-med-exam').onclick=function(){addMedExamRow();};

  // Med row
  var amm=function(n,d,c){var row=document.createElement('div');row.className='med-med-row meal-item-row';var ni=document.createElement('input');ni.type='text';ni.name='medName';ni.placeholder='药品名';ni.value=n||'';row.appendChild(ni);var di=document.createElement('input');di.type='text';di.name='medDosage';di.placeholder='用法用量';di.value=d||'';row.appendChild(di);var ci=document.createElement('input');ci.type='number';ci.name='medCost';ci.placeholder='费用';ci.value=c||'';ci.step='0.01';ci.oninput=updateMedSubTotal;row.appendChild(ci);var rm=document.createElement('button');rm.type='button';rm.className='btn-remove';rm.textContent='✕';rm.onclick=function(){row.remove();updateMedSubTotal();};row.appendChild(rm);document.querySelector('#modal-body #med-med-items').appendChild(row);};
  function updateMedSubTotal(){var t=0;document.querySelectorAll('#modal-body #med-exam-items .exam-item-row [name="examCost"]').forEach(function(el){t+=parseFloat(el.value)||0;});document.querySelectorAll('#modal-body .med-med-row [name="medCost"]').forEach(function(el){t+=parseFloat(el.value)||0;});var st=document.getElementById('med-sub-total');if(st)st.value=t.toFixed(2);var hc=parseFloat(document.getElementById('hc-total-cost')?document.getElementById('hc-total-cost').value:'0')||0;var ct=document.getElementById('combined-total');if(ct)ct.textContent=(hc+t).toFixed(2);}
  if(existing&&existing.med_medicineItems){existing.med_medicineItems.forEach(function(m){amm(m.name,m.dosage,m.cost);});}
  if(!document.querySelector('#modal-body #med-med-items').children.length)amm();
  document.getElementById('btn-add-med-med').onclick=function(){amm();};
  // Now that all rows are created, calculate totals
  if(document.getElementById('chk-is-medical')&&document.getElementById('chk-is-medical').checked){updateMedSubTotal();var s=document.getElementById('med-start-date'),e=document.getElementById('med-end-date'),el=document.getElementById('med-days');if(s&&e&&s.value&&e.value&&el){var d=Math.round((new Date(e.value+'T00:00:00')-new Date(s.value+'T00:00:00'))/86400000)+1;el.textContent='共'+d+'天';}}
};

// ===== 10. 财务 =====
UIRenderer.renderFinance = function() {
  var c={vaccine:0,checkup:0,deworming:0,medical:0},items=[];
  DataManager.getSection('vaccineRecords').forEach(function(v){c.vaccine+=v.cost||0;items.push({date:v.date,cat:'💉 疫苗',name:v.vaccineName+' 第'+v.doseNumber+'针',cost:v.cost||0});});
  DataManager.getSection('healthCheckRecords').forEach(function(h){c.checkup+=h.totalCost||0;items.push({date:h.date,cat:'🩺 体检',name:h.chiefComplaint||'体检',cost:h.totalCost||0});});
  (DataManager.getSection('dewormingRecords')||[]).forEach(function(d){c.deworming+=d.cost||0;items.push({date:d.date,cat:'🪱 驱虫',name:d.productName||'驱虫',cost:d.cost||0});});
  (DataManager.getSection('medicalRecords')||[]).forEach(function(m){var mc=m.totalCost||0;c.medical+=mc;items.push({date:m.date,cat:'💊 就医',name:m.diagnosis||m.symptoms||'就诊',cost:mc,insurance:m.insuranceReimbursement||0});});
  var total=c.vaccine+c.checkup+c.deworming+c.medical;items.sort(function(a,b){return b.date.localeCompare(a.date);});
  var html='<div class="card-grid-2col">';
  [{icon:'💉',label:'疫苗',val:c.vaccine},{icon:'🩺',label:'体检',val:c.checkup},{icon:'🪱',label:'驱虫',val:c.deworming},{icon:'💊',label:'就医',val:c.medical}].forEach(function(x){html+='<div class="card" style="text-align:center"><div style="font-size:28px">'+x.icon+'</div><p style="font-size:12px;color:var(--color-text-secondary)">'+x.label+'</p><p class="highlight">'+Utils.fmtMoney(x.val)+'</p></div>';});
  html+='</div><div class="card" style="text-align:center;background:#FFF0EB"><p style="font-size:14px;color:var(--color-text-secondary)">💰 总花费</p><p class="highlight" style="font-size:36px">'+Utils.fmtMoney(total)+'</p></div>';
  html+='<div class="card"><h3>📋 消费明细</h3><table class="data-table"><thead><tr><th>日期</th><th>类别</th><th>项目</th><th>费用</th><th>报销</th></tr></thead><tbody>';
  items.forEach(function(i){html+='<tr><td>'+Utils.formatDateShort(i.date)+'</td><td>'+i.cat+'</td><td>'+Utils.escape(i.name)+'</td><td>'+Utils.fmtMoney(i.cost)+'</td><td>'+(i.insurance?Utils.fmtMoney(i.insurance):'—')+'</td></tr>';});
  html+='</tbody></table></div>';document.getElementById('finance-content').innerHTML=html;
};

// ===== 11. 提醒同步 =====
var _origCompleteReminder = ReminderEngine.completeReminder;
ReminderEngine.completeReminder = function(id) {
  var rems=DataManager.getSection('reminders'),r=rems.find(function(x){return x.id===id;});if(!r)return;
  _origCompleteReminder.call(this,id);
  var hev=DataManager.getSection('healthEvents')||[],found=false;
  hev.forEach(function(e){if(e.title===r.title&&e.date===r.date&&!e.completed){e.completed=true;found=true;}});
  if(found)DataManager._save();
  setTimeout(function(){UIRenderer.renderDashboard();Router.updateNavBadges();},200);
};

// ===== 11b. 疫苗页面覆盖 =====
UIRenderer.renderVaccine = function() {
  var records=[].concat(DataManager.getSection('vaccineRecords')).sort(function(a,b){return b.date.localeCompare(a.date);});
  var html='<div class="timeline">';if(!records.length)html+='<div class="empty-state"><div class="empty-icon">💉</div><p>还没有疫苗记录</p></div>';
  records.forEach(function(r){html+='<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-content card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h4 style="margin:0">'+Utils.escape(r.vaccineName)+' 第'+r.doseNumber+'针</h4>';if(r.cost)html+='<span style="font-size:13px;font-weight:600;color:var(--color-primary)">'+Utils.fmtMoney(r.cost)+'</span>';html+='</div><time>'+Utils.formatDate(r.date)+'</time>';
  if(r.hospital)html+='<p>🏥 '+Utils.escape(r.hospital)+'</p>';
  html+='<p>🏷️ '+Utils.escape(r.brand)+(r.batchNumber?' · 批号 '+Utils.escape(r.batchNumber):'')+'</p>';
  if(r.nextDueDate){var dl=Utils.daysBetween(Utils.todayDate(),new Date(r.nextDueDate+'T00:00:00'));html+='<span class="badge-next">📅 下次: '+r.nextDueDate+(dl>0?' (还有'+dl+'天)':'')+'</span>';}
  if(r.note)html+='<p style="margin-top:4px;font-size:12px;color:var(--color-text-muted)">📝 '+Utils.escape(r.note)+'</p>';
  html+='<div class="card-actions"><button class="btn-sm btn-outline" data-action="edit-vac" data-id="'+r.id+'">✏️</button><button class="btn-sm btn-danger" data-action="delete-vac" data-id="'+r.id+'">🗑️</button></div></div></div>';});
  html+='</div><button class="btn-add" id="btn-add-vaccine">➕ 添加疫苗记录</button>';
  document.getElementById('health-sub-vaccine').innerHTML=html;
  document.getElementById('health-sub-vaccine').onclick=function(e){var btn=e.target.closest('button');if(!btn)return;var id=btn.dataset.id;if(btn.dataset.action==='edit-vac')UIRenderer._showVaccineForm(records.find(function(x){return x.id===id;}));else if(btn.dataset.action==='delete-vac')UIRenderer._handleDelete('vaccineRecords',id,function(){UIRenderer.renderVaccine();});};
  document.getElementById('btn-add-vaccine').onclick=function(){UIRenderer._showVaccineForm(null);};
};

// ===== 11c. 美化体重折线图 =====
WeightChart.draw = function(data) {
  var canvas=document.getElementById('weight-chart');
  if(!canvas||data.length===0)return;
  var dpr=window.devicePixelRatio||1;
  var dw=canvas.clientWidth||600,dh=canvas.clientHeight||260;
  canvas.width=dw*dpr;canvas.height=dh*dpr;
  var ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  var pad={top:20,right:24,bottom:44,left:80},gridLeft=pad.left-28;
  var pw=dw-pad.left-pad.right,ph=dh-pad.top-pad.bottom;
  ctx.clearRect(0,0,dw,dh);
  var dates=data.map(function(d){return new Date(d.date+'T00:00:00');});
  var weights=data.map(function(d){return d.weight;});
  var minDate=dates[0],maxDate=dates[dates.length-1];
  var dateRange=maxDate-minDate||86400000;
  var minW=Math.floor(Math.min.apply(null,weights)*10)/10-0.1;
  var maxW=Math.ceil(Math.max.apply(null,weights)*10)/10+0.1;
  if(maxW-minW<0.4){var mid=(minW+maxW)/2;minW=mid-0.3;maxW=mid+0.3;}
  if(minW<0)minW=0;
  var xScale=function(d){return pad.left+((d-minDate)/dateRange)*pw;};
  var yScale=function(w){return pad.top+ph-((w-minW)/(maxW-minW))*ph;};
  // Subtle grid
  var ySteps=4;
  for(var i=0;i<=ySteps;i++){var y=pad.top+(ph/ySteps)*i;ctx.strokeStyle='#F0E8E4';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(gridLeft,y);ctx.lineTo(pad.left+pw,y);ctx.stroke();var val=maxW-((maxW-minW)/ySteps)*i;ctx.fillStyle='#BCAAA4';ctx.font='10px sans-serif';ctx.textAlign='right';ctx.fillText(val.toFixed(1)+'kg',gridLeft-4,y+3);}
  // X labels (first, middle, last)
  ctx.textAlign='center';ctx.fillStyle='#BCAAA4';ctx.font='10px sans-serif';
  [0,Math.floor((dates.length-1)/2),dates.length-1].forEach(function(i){ctx.fillText(Utils.formatDateShort(data[i].date),xScale(dates[i]),pad.top+ph+16);});
  // Area fill
  var grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ph);
  grad.addColorStop(0,'rgba(255,140,105,0.15)');grad.addColorStop(1,'rgba(255,140,105,0.02)');
  ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(xScale(dates[0]),pad.top+ph);
  data.forEach(function(d,i){ctx.lineTo(xScale(dates[i]),yScale(d.weight));});
  ctx.lineTo(xScale(dates[dates.length-1]),pad.top+ph);ctx.closePath();ctx.fill();
  // Smooth line
  ctx.strokeStyle='#FF8C69';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  data.forEach(function(d,i){var x=xScale(dates[i]),y=yScale(d.weight);if(i===0){ctx.moveTo(x,y);return;}var px=xScale(dates[i-1]),py=yScale(data[i-1].weight);ctx.bezierCurveTo(px+(x-px)*0.5,py,px+(x-px)*0.5,y,x,y);});ctx.stroke();
  // Points
  data.forEach(function(d,i){var x=xScale(dates[i]),y=yScale(d.weight);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#FF8C69';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#5D4037';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(d.weight.toFixed(1),x,y-10);});
};

// ===== 12. 重定向 + Tab 名称 =====
UIRenderer.renderFeedingHistory = function() { Router.navigateSub('feeding','record'); };

whenReady(function() {
  var tabs=document.querySelectorAll('#app-nav .nav-tab');tabs.forEach(function(t){if(t.dataset.tab==='feeding'){t.querySelector('.nav-icon').textContent='🍽️';t.childNodes[t.childNodes.length-1].textContent='喂养';}});
  setTimeout(function(){var st=document.querySelectorAll('#feeding-sub-nav button');st.forEach(function(b){if(b.dataset.sub==='record')b.innerHTML='📝 喂食记录';});},50);
});

// ===== 13. 强制重渲染 =====
document.title = '🐱 糯米饲养助手';
(function tryRender(){
  var dv=document.getElementById('view-dashboard');
  var ok=dv&&DataManager.data&&DataManager.data();
  if(!ok){setTimeout(tryRender,30);return;}
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active');});
  dv.classList.add('active');
  document.querySelectorAll('#app-nav .nav-tab').forEach(function(t){t.classList.remove('active');});
  var tb=document.querySelector('#app-nav .nav-tab[data-tab="dashboard"]');
  if(tb)tb.classList.add('active');
  UIRenderer.renderDashboard();
  if(Router){Router.currentTab='dashboard';}
  setTimeout(function(){UIRenderer.renderDashboard();},300);
  setTimeout(function(){UIRenderer.renderDashboard();},800);
})();
