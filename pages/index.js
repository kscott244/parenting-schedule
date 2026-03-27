import { useState, useEffect } from 'react';
import Head from 'next/head';

const DAD_COLOR = '#4472C4';
const MOM_COLOR = '#E85555';
const EXC_COLOR = '#8e44ad';
const DC_COLOR  = '#e6a817';

const SCHEDULE_START  = '2026-03-27';
const START_PARENT    = 'b'; // Mom
const CYCLE_START_DOW = 5;   // Friday
const DISPLAY_MONTH   = 3;
const DISPLAY_YEAR    = 2026;
const NUM_MONTHS      = 10;

const EXCEPTIONS = {
  '2026-04-05': 'Easter Sunday — Mom picks kids up from Dad\'s home in the morning. Mom drops kids back to Dad at 2PM. Not at daycare.'
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function buildSchedule() {
  const startDate = new Date(SCHEDULE_START + 'T00:00:00');
  const daysBack = (startDate.getDay() - CYCLE_START_DOW + 7) % 7;
  const anchor = new Date(startDate);
  anchor.setDate(anchor.getDate() - daysBack);

  function ownerAtIdx(idx, threeNight) {
    if (idx <= 2) return threeNight;
    if (idx <= 4) return threeNight === 'a' ? 'b' : 'a';
    return threeNight;
  }
  function isDropoff(idx) { return idx === 0 || idx === 3 || idx === 5; }

  let cycleOwner;
  if (daysBack <= 2) cycleOwner = START_PARENT;
  else if (daysBack <= 4) cycleOwner = START_PARENT === 'a' ? 'b' : 'a';
  else cycleOwner = START_PARENT;

  const sched = {};
  for (let i = 0; i < NUM_MONTHS * 31 + 15; i++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    const idx = i % 7;
    const cycleNum = Math.floor(i / 7);
    const threeNight = cycleNum % 2 === 0 ? cycleOwner : (cycleOwner === 'a' ? 'b' : 'a');
    const owner = ownerAtIdx(idx, threeNight);
    let dropper = null;
    if (isDropoff(idx)) {
      const pi = idx === 0 ? 6 : idx - 1;
      const pc = idx === 0 ? cycleNum - 1 : cycleNum;
      const pt = pc % 2 === 0 ? cycleOwner : (cycleOwner === 'a' ? 'b' : 'a');
      dropper = ownerAtIdx(pi, pt);
    }
    sched[isoDate(d)] = { owner, dropper, exception: EXCEPTIONS[isoDate(d)] || null };
  }
  return sched;
}

const sched = buildSchedule();

function DayCell({ day, mo, yr, info, closure }) {
  if (!info) return <div style={styles.cell} />;

  const iso = `${yr}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const isClosed = !!closure;
  const isExc = !!info.exception;

  let leftColor, rightColor, label, isSplit = false;

  if (isClosed) {
    leftColor = rightColor = DC_COLOR;
    label = <span style={{...styles.labelCenter, color: '#9a6800'}}>Closed</span>;
  } else if (isExc) {
    leftColor = rightColor = EXC_COLOR;
    label = <span style={{...styles.labelCenter, color: '#6a00aa'}}>Exception</span>;
  } else if (!info.dropper) {
    leftColor = rightColor = info.owner === 'a' ? DAD_COLOR : MOM_COLOR;
    label = <span style={{...styles.labelCenter, color: info.owner === 'a' ? '#1a4f8a' : '#c0392b'}}>
      {info.owner === 'a' ? 'Dad' : 'Mom'}
    </span>;
  } else {
    isSplit = true;
    leftColor = info.dropper === 'a' ? DAD_COLOR : MOM_COLOR;
    rightColor = info.owner === 'a' ? DAD_COLOR : MOM_COLOR;
    label = <>
      <span style={{color: info.dropper === 'a' ? '#1a4f8a' : '#c0392b', fontWeight:'bold', fontSize:8}}>
        {info.dropper === 'a' ? 'Dad' : 'Mom'}
      </span>
      <span style={{color: info.owner === 'a' ? '#1a4f8a' : '#c0392b', fontWeight:'bold', fontSize:8}}>
        {info.owner === 'a' ? 'Dad' : 'Mom'}
      </span>
    </>;
  }

  const cellBg = isClosed ? '#fffbea' : '#fff';

  return (
    <div style={{...styles.cell, background: cellBg}}>
      <span style={styles.dayNum}>{day}</span>
      <div style={styles.shape}>
        {isExc ? (
          <div style={{...styles.shapeFill, background: EXC_COLOR, alignItems:'center', justifyContent:'center', fontSize:16}}>⚡</div>
        ) : isClosed ? (
          <div style={{...styles.shapeFill, background: DC_COLOR, alignItems:'center', justifyContent:'center', fontSize:16}}>🚫</div>
        ) : isplit ? null : !info.dropper ? (
          <div style={{...styles.shapeFill, background: leftColor}} />
        ) : (
          <div style={{display:'flex', width:'100%', height:'100%'}}>
            <div style={{flex:1, background: leftColor, borderRadius: '4px 0 0 4px'}} />
            <div style={{flex:1, background: rightColor, borderRadius: '0 4px 4px 0'}} />
          </div>
        )}
      </div>
      <div style={{...styles.labelRow, justifyContent: (!isplit && !info.dropper) || isClosed || isExc ? 'center' : 'space-between'}}>
        {label}
      </div>
    </div>
  );
}

export default function Home() {
  const [closures, setClosures] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [dcDate, setDcDate] = useState('');
  const [dcNote, setDcNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/closures')
      .then(r => r.json())
      .then(data => { setClosures(data); setLoading(false); })
      .catch(() => setLoading(false));

    // Poll every 30 seconds for updates from other devices
    const interval = setInterval(() => {
      fetch('/api/closures')
        .then(r => r.json())
        .then(data => setClosures(data))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function saveClosure() {
    if (!dcDate) { alert('Please select a date.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dcDate, note: dcNote || 'Daycare Closed' })
      });
      const data = await res.json();
      setClosures(data.closures);
      setModalOpen(false);
      setDcDate('');
      setDcNote('');
    } catch (e) {
      alert('Failed to save. Please try again.');
    }
    setSaving(false);
  }

  async function deleteClosure(date) {
    try {
      const res = await fetch('/api/closures', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      const data = await res.json();
      setClosures(data.closures);
    } catch (e) {}
  }

  const months = [];
  for (let m = 0; m < NUM_MONTHS; m++) {
    let mo = DISPLAY_MONTH + m;
    let yr = DISPLAY_YEAR;
    while (mo > 12) { mo -= 12; yr++; }
    months.push({ mo, yr });
  }

  return (
    <>
      <Head>
        <title>Parenting Schedule 2026</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={styles.page}>
        <h1 style={styles.h1}>Parenting Schedule 2026</h1>
        <p style={styles.subtitle}>
          All exchanges at daycare · Left = Drop-off · Right = Pickup
        </p>

        {/* Legend */}
        <div style={styles.legend}>
          <LegItem color={DAD_COLOR} label="Dad full day" />
          <LegItem color={MOM_COLOR} label="Mom full day" />
          <LegItemSplit left={DAD_COLOR} right={MOM_COLOR} label="Dad drops / Mom picks up" />
          <LegItemSplit left={MOM_COLOR} right={DAD_COLOR} label="Mom drops / Dad picks up" />
          <LegItemIcon color={EXC_COLOR} icon="⚡" label="Exception" />
          <LegItemIcon color={DC_COLOR} icon="✕" label="Daycare Closed" />
        </div>

        {/* Daycare button */}
        <div style={{textAlign:'right', maxWidth:700, margin:'0 auto 12px', padding:'0 8px'}}>
          <button style={styles.dcBtn} onClick={() => setModalOpen(true)}>
            🚫 Mark Daycare Closed
          </button>
        </div>

        {/* Months */}
        {months.map(({ mo, yr }) => {
          const firstDOW = new Date(yr, mo-1, 1).getDay();
          const totalDays = new Date(yr, mo, 0).getDate();
          const monthClosures = Object.entries(closures).filter(([d]) => {
            const [y,m2] = d.split('-').map(Number);
            return y === yr && m2 === mo;
          });
          const monthExceptions = Object.entries(sched).filter(([d, v]) => {
            const [y,m2] = d.split('-').map(Number);
            return y === yr && m2 === mo && v.exception;
          });

          return (
            <div key={`${yr}-${mo}`} style={{maxWidth:700, margin:'0 auto 0'}}>
              <div style={styles.month}>
                <div style={styles.monthTitle}>{MONTH_NAMES[mo-1].toUpperCase()} {yr}</div>
                <div style={styles.calGrid}>
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} style={styles.dow}>{d}</div>
                  ))}
                  {Array(firstDOW).fill(null).map((_, i) => (
                    <div key={`e${i}`} style={styles.emptyCell} />
                  ))}
                  {Array(totalDays).fill(null).map((_, i) => {
                    const day = i + 1;
                    const iso = `${yr}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const info = sched[iso];
                    const closure = closures[iso];
                    return (
                      <DayCellFull key={day} day={day} iso={iso} info={info} closure={closure} onDelete={deleteClosure} />
                    );
                  })}
                </div>
              </div>

              {/* Keys */}
              {(monthClosures.length > 0 || monthExceptions.length > 0) && (
                <div>
                  {monthClosures.length > 0 && (
                    <div style={{...styles.keyBox, background:'#fffbea', border:'1px solid #e6c84e'}}>
                      <div style={{...styles.keyTitle, color:'#9a6800'}}>🚫 Daycare Closures</div>
                      {monthClosures.map(([date, note]) => (
                        <div key={date} style={styles.keyItem}>
                          <div style={{...styles.keyBullet, background: DC_COLOR}} />
                          <div style={{flex:1}}>
                            <strong>{new Date(date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</strong>
                            {' — '}{note}
                          </div>
                          <button onClick={() => deleteClosure(date)} style={styles.delBtn}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {monthExceptions.length > 0 && (
                    <div style={{...styles.keyBox, background:'#f5f0ff', border:'1px solid #c9b0f0'}}>
                      <div style={{...styles.keyTitle, color:'#5a00aa'}}>⚡ Exception Key</div>
                      {monthExceptions.map(([date, info]) => (
                        <div key={date} style={styles.keyItem}>
                          <div style={{...styles.keyBullet, background: EXC_COLOR}} />
                          <div>
                            <strong>{new Date(date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</strong>
                            {' — '}{info.exception}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{height:16}} />
            </div>
          );
        })}

        {/* Modal */}
        {modalOpen && (
          <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
            <div style={styles.modal}>
              <h3 style={{fontSize:16, marginBottom:16, color:'#222'}}>🚫 Mark Daycare Closed</h3>
              <label style={styles.label}>Date</label>
              <input
                type="date"
                value={dcDate}
                onChange={e => setDcDate(e.target.value)}
                style={styles.input}
              />
              <label style={styles.label}>Reason (optional)</label>
              <input
                type="text"
                value={dcNote}
                onChange={e => setDcNote(e.target.value)}
                placeholder="e.g. Staff Training Day"
                style={styles.input}
              />
              <div style={{display:'flex', gap:10, marginTop:4}}>
                <button style={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
                <button style={styles.saveBtn} onClick={saveClosure} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function DayCellFull({ day, iso, info, closure, onDelete }) {
  if (!info) return <div style={styles.cell} />;

  const isClosed = !!closure;
  const isExc = !!info.exception;
  const cellBg = isClosed ? '#fffbea' : '#fff';

  let shapeContent;
  let labelContent;

  if (isClosed) {
    // Show original Mom/Dad colors with 🚫 overlaid on top
    let baseShape;
    if (!info.dropper) {
      const color = info.owner === 'a' ? DAD_COLOR : MOM_COLOR;
      baseShape = <div style={{...styles.shapeFill, background: color}} />;
    } else {
      const lc = info.dropper === 'a' ? DAD_COLOR : MOM_COLOR;
      const rc = info.owner === 'a' ? DAD_COLOR : MOM_COLOR;
      baseShape = (
        <div style={{display:'flex', width:'100%', height:'100%'}}>
          <div style={{flex:1, background: lc, borderRadius:'4px 0 0 4px'}} />
          <div style={{flex:1, background: rc, borderRadius:'0 4px 4px 0'}} />
        </div>
      );
    }
    shapeContent = (
      <div style={{position:'relative', width:'100%', height:'100%'}}>
        {baseShape}
        <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{background:'white', borderRadius:4, padding:'1px 5px', fontSize:8, fontWeight:'bold', color:'#333', boxShadow:'0 1px 3px rgba(0,0,0,0.4)', letterSpacing:0.3}}>CLOSED</div>
        </div>
      </div>
    );
    labelContent = <span style={{...styles.labelCenter, color:'#9a6800', fontSize:7}}>Closed</span>;
  } else if (isExc) {
    shapeContent = <div style={{...styles.shapeFill, background: EXC_COLOR, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>⚡</div>;
    labelContent = <span style={{...styles.labelCenter, color:'#6a00aa'}}>Exception</span>;
  } else if (!info.dropper) {
    const color = info.owner === 'a' ? DAD_COLOR : MOM_COLOR;
    shapeContent = <div style={{...styles.shapeFill, background: color}} />;
    labelContent = <span style={{...styles.labelCenter, color: info.owner === 'a' ? '#1a4f8a' : '#c0392b'}}>
      {info.owner === 'a' ? 'Dad' : 'Mom'}
    </span>;
  } else {
    const lc = info.dropper === 'a' ? DAD_COLOR : MOM_COLOR;
    const rc = info.owner === 'a' ? DAD_COLOR : MOM_COLOR;
    shapeContent = (
      <div style={{display:'flex', width:'100%', height:'100%'}}>
        <div style={{flex:1, background: lc, borderRadius:'4px 0 0 4px'}} />
        <div style={{flex:1, background: rc, borderRadius:'0 4px 4px 0'}} />
      </div>
    );
    labelContent = (
      <>
        <span style={{color: info.dropper==='a'?'#1a4f8a':'#c0392b', fontWeight:'bold', fontSize:8}}>
          {info.dropper==='a'?'Dad':'Mom'}
        </span>
        <span style={{color: info.owner==='a'?'#1a4f8a':'#c0392b', fontWeight:'bold', fontSize:8}}>
          {info.owner==='a'?'Dad':'Mom'}
        </span>
      </>
    );
  }

  return (
    <div style={{...styles.cell, background: cellBg}}>
      <span style={styles.dayNum}>{day}</span>
      <div style={styles.shape}>{shapeContent}</div>
      <div style={{
        ...styles.labelRow,
        justifyContent: !info.dropper || isClosed || isExc ? 'center' : 'space-between'
      }}>
        {labelContent}
      </div>
    </div>
  );
}

function LegItem({ color, label }) {
  return (
    <div style={styles.legItem}>
      <div style={{width:18, height:18, borderRadius:3, background:color, flexShrink:0}} />
      <span style={{fontSize:10}}>{label}</span>
    </div>
  );
}

function LegItemSplit({ left, right, label }) {
  return (
    <div style={styles.legItem}>
      <div style={{width:18, height:18, borderRadius:3, overflow:'hidden', display:'flex', flexShrink:0}}>
        <div style={{flex:1, background:left}} />
        <div style={{flex:1, background:right}} />
      </div>
      <span style={{fontSize:10}}>{label}</span>
    </div>
  );
}

function LegItemIcon({ color, icon, label }) {
  return (
    <div style={styles.legItem}>
      <div style={{width:18, height:18, borderRadius:3, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0}}>
        {icon}
      </div>
      <span style={{fontSize:10}}>{label}</span>
    </div>
  );
}

const styles = {
  page: { fontFamily:'Arial,sans-serif', background:'#f0f0f0', minHeight:'100vh', padding:'14px 8px', boxSizing:'border-box' },
  h1: { textAlign:'center', fontSize:18, fontWeight:'bold', marginBottom:4, color:'#222' },
  subtitle: { textAlign:'center', fontSize:10, color:'#666', marginBottom:12 },
  legend: { display:'flex', justifyContent:'center', gap:12, marginBottom:14, flexWrap:'wrap', alignItems:'center' },
  legItem: { display:'flex', alignItems:'center', gap:5 },
  dcBtn: { background:DC_COLOR, color:'white', border:'none', borderRadius:7, padding:'9px 14px', fontSize:12, fontWeight:'bold', cursor:'pointer' },
  month: { background:'white', borderRadius:8, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.15)' },
  monthTitle: { background:'#222', color:'white', textAlign:'center', fontSize:13, fontWeight:'bold', padding:7, letterSpacing:1 },
  calGrid: { display:'grid', gridTemplateColumns:'repeat(7, 1fr)' },
  dow: { textAlign:'center', fontSize:9, fontWeight:'bold', padding:'4px 1px', background:'#eee', border:'1px solid #ddd', color:'#555' },
  cell: { border:'1px solid #e8e8e8', height:72, padding:'3px 2px 2px', display:'flex', flexDirection:'column', alignItems:'center', overflow:'hidden' },
  emptyCell: { border:'1px solid #e8e8e8', height:72, background:'#fafafa' },
  dayNum: { fontSize:10, fontWeight:'bold', color:'#333', alignSelf:'flex-start', paddingLeft:2, marginBottom:2, lineHeight:1 },
  shape: { width:'90%', flex:1, borderRadius:5, overflow:'hidden', display:'flex', marginBottom:3 },
  shapeFill: { width:'100%', height:'100%' },
  labelRow: { display:'flex', width:'95%', lineHeight:1, padding:'0 1px' },
  labelCenter: { textAlign:'center', width:'100%', fontWeight:'bold', fontSize:8 },
  keyBox: { borderRadius:'0 0 8px 8px', padding:'10px 14px', marginBottom:0 },
  keyTitle: { fontSize:10, fontWeight:'bold', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.4px' },
  keyItem: { display:'flex', gap:8, alignItems:'flex-start', fontSize:11, color:'#333', marginBottom:4, lineHeight:1.4 },
  keyBullet: { width:14, height:14, borderRadius:3, flexShrink:0, marginTop:1 },
  delBtn: { background:'none', border:'none', color:'#c0392b', fontSize:14, cursor:'pointer', padding:'0 4px', flexShrink:0 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  modal: { background:'white', borderRadius:'16px 16px 0 0', padding:'24px 22px 40px', width:'100%', maxWidth:500 },
  label: { display:'block', fontSize:12, fontWeight:'bold', color:'#444', marginBottom:5 },
  input: { width:'100%', padding:'9px 10px', border:'1px solid #ccc', borderRadius:6, fontSize:13, marginBottom:12, boxSizing:'border-box' },
  cancelBtn: { flex:1, padding:10, background:'#eee', color:'#444', border:'none', borderRadius:6, fontSize:13, cursor:'pointer' },
  saveBtn: { flex:1, padding:10, background:DC_COLOR, color:'white', border:'none', borderRadius:6, fontSize:13, fontWeight:'bold', cursor:'pointer' },
};
