function validateMaster(master) {
  if (!master || typeof master !== 'object') throw new Error('The chapter master payload is missing.');
  if (!Array.isArray(master.chapters)) throw new Error('The chapter master has no chapters array.');
  const size = Buffer.byteLength(JSON.stringify(master), 'utf8');
  if (size > 4_500_000) throw new Error('The chapter master is too large for this sync bridge.');
  return master;
}
async function callBridge(action, master) {
  const url = String(process.env.GOOGLE_BIBLE_BRIDGE_URL || '').trim();
  const secret = String(process.env.GOOGLE_BIBLE_BRIDGE_SECRET || '').trim();
  if (!url) throw new Error('GOOGLE_BIBLE_BRIDGE_URL is not configured in Vercel.');
  if (!secret) throw new Error('GOOGLE_BIBLE_BRIDGE_SECRET is not configured in Vercel.');
  const payload = {action, resource:'chapters', secret};
  if (master) payload.master = master;
  const response = await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});
  const text=await response.text();
  let data; try{data=JSON.parse(text);}catch{throw new Error('Google Drive bridge returned an unreadable response.');}
  if(!response.ok || !data?.ok) throw new Error(data?.error || `Google Drive bridge failed (${response.status}).`);
  return data;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method==='GET'){
      const result=await callBridge('get');
      return res.status(200).json(validateMaster(result.master));
    }
    if(req.method==='POST'){
      const master=validateMaster(req.body?.master);
      master.updatedAt=new Date().toISOString();
      const result=await callBridge('put',master);
      return res.status(200).json({ok:true,master:validateMaster(result.master||master)});
    }
    res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed'});
  }catch(err){return res.status(500).json({error:err?.message||'Google Drive chapter sync failed.'});}
}
