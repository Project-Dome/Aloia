"""DEV-623: compara os objetos de script do repo (src/Objects/custom_script) com os importados da PROD.
Uso: python claude/tools/compare_prod.py <pasta_com_xmls_da_prod>
Compara por script: isinactive, scriptfile, parametros; por deployment: status, isdeployed, audiencia,
recordtype, eventtype, executioncontext, loglevel, runasrole, agendamento (recurrence) e valores de parametros."""
import re, sys, glob, os
REPO = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'Objects', 'custom_script')
PROD = sys.argv[1]
SCRIPT_TAGS = ['isinactive', 'scriptfile', 'name']
DEP_TAGS = ['status', 'isdeployed', 'allroles', 'audslctrole', 'allemployees', 'allpartners', 'audemployee',
            'auddepartment', 'audsubsidiary', 'recordtype', 'eventtype', 'executioncontext', 'loglevel', 'runasrole',
            'isonline', 'title']
def tag(b, t):
    m = re.search(r'<%s>(.*?)</%s>' % (t, t), b, re.S); return m.group(1).strip() if m else None
def parse(path):
    s = open(path, encoding='utf-8').read()
    head = re.split(r'<scriptdeployments>|<scriptcustomfields>', s)[0]
    d = {'script': {t: tag(head, t) for t in SCRIPT_TAGS}, 'params': {}, 'deps': {}}
    for m in re.finditer(r'<scriptcustomfield scriptid="([^"]+)">(.*?)</scriptcustomfield>', s, re.S):
        d['params'][m.group(1)] = tag(m.group(2), 'defaultvalue')
    for m in re.finditer(r'<scriptdeployment scriptid="([^"]+)">(.*?)</scriptdeployment>', s, re.S):
        b = m.group(2); dd = {t: tag(b, t) for t in DEP_TAGS}
        rec = re.search(r'<recurrence>(.*?)</recurrence>', b, re.S)
        dd['recurrence'] = re.sub(r'\s+', ' ', rec.group(1)).strip() if rec else None
        dd['paramvalues'] = ' '.join(sorted(re.sub(r'\s+', ' ', x) for x in re.findall(r'<custscript[^>]*>[^<]*</custscript[^>]*>', b)))
        d['deps'][m.group(1)] = dd
    return d
repo = {os.path.basename(f)[:-4]: parse(f) for f in glob.glob(os.path.join(REPO, '*.xml'))}
prod = {os.path.basename(f)[:-4]: parse(f) for f in glob.glob(os.path.join(PROD, '**', '*.xml'), recursive=True)
        if os.path.basename(f).startswith('customscript')}
print('repo: %d  prod: %d' % (len(repo), len(prod)))
for k in sorted(repo):
    if k not in prod: print('\n### %s: NAO EXISTE NA PROD (vai ser criado)' % k); continue
    r, p, out = repo[k], prod[k], []
    for t in SCRIPT_TAGS:
        if t != 'scriptfile' and r['script'][t] != p['script'][t]: out.append('script.%s: repo=%r prod=%r' % (t, r['script'][t], p['script'][t]))
    out.append('scriptfile prod: %s' % p['script']['scriptfile']) if p['script']['scriptfile'] != r['script']['scriptfile'] else None
    for pk in sorted(set(r['params']) | set(p['params'])):
        if r['params'].get(pk) != p['params'].get(pk): out.append('param %s: repo=%r prod=%r' % (pk, r['params'].get(pk), p['params'].get(pk)))
    for dk in sorted(set(r['deps']) | set(p['deps'])):
        rd, pd = r['deps'].get(dk), p['deps'].get(dk)
        if rd is None: out.append('deploy %s: SO NA PROD (o deploy nao apaga, fica como esta)' % dk); continue
        if pd is None: out.append('deploy %s: so no repo (vai ser criado)' % dk); continue
        for t in DEP_TAGS + ['recurrence', 'paramvalues']:
            if rd.get(t) != pd.get(t): out.append('deploy %s.%s: repo=%r prod=%r' % (dk, t, rd.get(t), pd.get(t)))
    print('\n### %s%s' % (k, '' if [o for o in out if not o.startswith('scriptfile prod')] else ' (ok)'))
    for o in out: print('  - ' + o)
