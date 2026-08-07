# Quick test of the pattern matching logic (mirrors computeSuggestion)

VALID_WINNERS = ['Meron', 'Wala']
VALID_SIDES = ['Lyamado', 'Dehado']

patterns = [
    {'seq': ['Wala','Wala','Wala','Wala'], 'result': 'Meron'},
    {'seq': ['Meron','Meron','Meron','Meron'], 'result': 'Wala'},
    {'seq': ['Lyamado','Lyamado','Lyamado','Lyamado'], 'result': 'Dehado'},
]

entries = []

def infer_pattern_target(seq):
    lower = [s.lower() for s in seq]
    all_w = all(any(w.lower()==v for w in VALID_WINNERS) for v in lower)
    all_s = all(any(s2.lower()==v for s2 in VALID_SIDES) for v in lower)
    if all_w: return 'winner'
    if all_s: return 'side'
    return None

def match_pattern_for_sequence(sequence, target):
    if not sequence: return None
    candidates = []
    for p in patterns:
        if not p.get('seq'): continue
        if p.get('target'):
            if p['target']!=target: continue
        else:
            inferred = infer_pattern_target(p['seq'])
            if inferred!=target: continue
        candidates.append(p)
    candidates.sort(key=lambda x: -len(x['seq']))
    recent = sequence[-10:]
    for p in candidates:
        pat = [s.lower() for s in p['seq']]
        cand = [s.lower() for s in recent[-len(p['seq']):]]
        if cand==pat:
            return p['result']
    return None

def compute_suggestion():
    winners = [e['winner'] for e in entries if e['winner'] in VALID_WINNERS]
    sides = [e['side'] for e in entries if e['side'] in VALID_SIDES]
    if not patterns:
        return 'PASS'
    winner_sugg = match_pattern_for_sequence(winners, 'winner')
    side_sugg = match_pattern_for_sequence(sides, 'side')
    if winner_sugg and side_sugg:
        if winner_sugg=='PASS' and side_sugg=='PASS': return 'PASS'
        if winner_sugg=='PASS': return side_sugg
        if side_sugg=='PASS': return winner_sugg
        if winner_sugg==side_sugg: return winner_sugg
        return f"{winner_sugg} + {side_sugg}"
    return winner_sugg or side_sugg or 'PASS'

# Scenario 1: add 4x Meron Lyamado
for i in range(4):
    entries.append({'start': i+1, 'winner': 'Meron', 'side': 'Lyamado'})
print('After 4x Meron Lyamado -> suggestion =', compute_suggestion())

# Scenario 2: add Wala Lyamado
entries.append({'start':5, 'winner':'Wala','side':'Lyamado'})
print('After adding Wala Lyamado -> suggestion =', compute_suggestion())
