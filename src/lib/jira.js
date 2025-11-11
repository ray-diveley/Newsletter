import axios from 'axios';

export function buildJql(projectKeys, statusList){
  const parts=[];
  if (projectKeys.length===1) parts.push(`project = "${projectKeys[0]}"`);
  else if (projectKeys.length>1) parts.push(`project in (${projectKeys.map(k=>`"${k}"`).join(', ')})`);
  if (statusList.length) parts.push(`status in (${statusList.map(s=>`"${s}"`).join(', ')})`);
  return `${parts.join(' AND ')} ORDER BY updated DESC`;
}

export async function searchAllIssues(domain, auth, jql){
  const pageSize=100; let startAt=0; let all=[];
  while(true){
    const fieldsParam = 'summary,status,resolutiondate,statuscategorychangedate,labels';
    
    const r = await axios.get(`https://${domain}/rest/api/3/search/jql`, {
      headers: { 
        Authorization: `Basic ${auth}`, 
        Accept: 'application/json'
      },
      params: {
        jql: jql,
        startAt: startAt,
        maxResults: pageSize,
        fields: fieldsParam
      }
    });
    const issues=r.data.issues||[]; all=all.concat(issues);
    if (startAt+pageSize >= (r.data.total||0)) break; startAt+=pageSize;
  }
  return all;
}
