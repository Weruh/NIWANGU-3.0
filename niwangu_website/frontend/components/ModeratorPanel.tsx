import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { Button } from './Button';
type Report={id:string;reported_name:string|null;reason:string;status:string;created_at:string};
export const ModeratorPanel=()=>{
 const [allowed,setAllowed]=useState(false);const [reports,setReports]=useState<Report[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{const {data,error}=await getSupabase().rpc('list_report_queue');if(error)setError(error.message);else setReports(data??[]);},[]);
 useEffect(()=>{let active=true;void getSupabase().auth.getUser().then(({data})=>{const role=data.user?.app_metadata?.role;if(active&&['admin','moderator'].includes(role)){setAllowed(true);void load();}});return()=>{active=false;};},[load]);
 if(!allowed)return null;
 const review=async(id:string,status:string,suspend=false)=>{setBusy(true);const {error}=await getSupabase().rpc('review_member_report',{p_report:id,p_status:status,p_suspend:suspend});if(error)setError(error.message);else await load();setBusy(false);};
 return <section className="mt-6 rounded-2xl border border-midnight/10 bg-white p-5"><h2 className="font-serif text-2xl">Safety reports</h2><p className="mt-2 text-sm text-midnight/65">Review reports before taking action. Suspending a member hides their profile and closes their conversations.</p>{error&&<p role="alert" className="mt-3 text-red-800">{error}</p>}{!reports.length&&<p className="mt-4 text-sm">No pending reports.</p>}<ul className="mt-5 space-y-4">{reports.map(r=><li key={r.id} className="rounded-xl border p-4"><p className="font-medium">{r.reported_name??'Deleted member'} · {r.status}</p><p className="my-3 whitespace-pre-wrap text-sm">{r.reason}</p><p className="mb-3 text-xs text-midnight/60">{new Date(r.created_at).toLocaleString()}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void review(r.id,'reviewing')}>Start review</Button><Button variant="outline" disabled={busy} onClick={()=>void review(r.id,'resolved')}>Resolve</Button><Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm('Suspend this member and close their conversations?'))void review(r.id,'resolved',true);}}>Suspend member</Button></div></li>)}</ul></section>;
};
