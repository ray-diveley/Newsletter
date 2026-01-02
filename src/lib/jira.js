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
    const fieldsParam = 'summary,status,resolutiondate,statuscategorychangedate,labels,description';

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
    console.log(`Fetched ${issues.length} issues (${startAt} to ${startAt + issues.length}), total available: ${r.data.total}, isLast: ${r.data.isLast}`);
    if (issues.length === 0 || issues.length < pageSize || r.data.isLast === true) break;
    if (all.length > 50000) { console.log(`WARNING: Hit safety limit at ${all.length} issues`); break; }
    startAt+=pageSize;
  }
  return all;
}
