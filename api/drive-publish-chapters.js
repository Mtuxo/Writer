function normalizeChapter(ch,index=0){
  const c=ch&&typeof ch==='object'?ch:{};
  return {id:String(c.id||`ch-${index+1}`),title:String(c.title||`Chapter ${index+1}`),text:String(c.text||''),meta:c.meta&&typeof c.meta==='object'?c.meta:{}};
}
async function callBridge(action,master){
  const url=String(process.env.GOOGLE_BIBLE_BRIDGE_URL||'').trim();
  const secret=String(process.env.GOOGLE_BIBLE_BRIDGE_SECRET||'').trim();
  if(!url) throw new Error('GOOGLE_BIBLE_BRIDGE_URL is not configured in Vercel.');
  if(!secret) throw new Error('GOOGLE_BIBLE_BRIDGE_SECRET is not configured in Vercel.');
  const payload={action,resource:'chapters',secret}; if(master) payload.master=master;
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});
  const text=await response.text(); let data; try{data=JSON.parse(text);}catch{throw new Error('Google Drive bridge returned an unreadable response.');}
  if(!response.ok||!data?.ok) throw new Error(data?.error||`Google Drive bridge failed (${response.status}).`);
  return data;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  try{
    let existing={schemaVersion:1,updatedAt:'',source:'Ethren Writing Studio master chapters',chapters:[]};
    try{const got=await callBridge('get'); if(got?.master&&Array.isArray(got.master.chapters)) existing=got.master;}catch(err){ if(!String(err.message).includes('Unexpected end')) throw err; }
    const mode=String(req.body?.mode||''); let chapters;
    if(mode==='all'){
      if(!Array.isArray(req.body?.chapters)) throw new Error('No chapters were provided.');
      chapters=req.body.chapters.map((ch,i)=>normalizeChapter(ch,i));
    }else if(mode==='current'){
      const incoming=normalizeChapter(req.body?.chapter,Number(req.body?.index)||0);
      chapters=Array.isArray(existing.chapters)?existing.chapters.map((ch,i)=>normalizeChapter(ch,i)):[];
      let at=chapters.findIndex(ch=>ch.id&&incoming.id&&ch.id===incoming.id);
      if(at<0) at=chapters.findIndex(ch=>ch.title.trim().toLowerCase()===incoming.title.trim().toLowerCase());
      if(at<0&&Number.isInteger(req.body?.index)&&req.body.index>=0&&req.body.index<chapters.length) at=req.body.index;
      if(at>=0) chapters[at]=incoming; else chapters.push(incoming);
    }else throw new Error('Unknown publish mode.');
    const updatedAt=new Date().toISOString();
    const payload={schemaVersion:1,updatedAt,source:'Ethren Writing Studio master chapters',chapters};
    const result=await callBridge('put',payload);
    return res.status(200).json({ok:true,updatedAt:String(result.master?.updatedAt||updatedAt),count:chapters.length,path:'Google Drive / ethren-chapters.json'});
  }catch(err){return res.status(500).json({error:err?.message||'Chapter publish failed.'});}
}
