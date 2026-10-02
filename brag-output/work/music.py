import numpy as np, wave
SR=44100; DUR=21.5; N=int(SR*DUR)
t=np.arange(N)/SR
rng=np.random.default_rng(7)
def note(m): return 440*2**((m-69)/12)
mix={k:np.zeros(N) for k in ['pad','pluck','bass','drums','fx']}
def add(bus,start,sig):
    i=int(start*SR); j=min(N,i+len(sig)); 
    if i<N: mix[bus][i:j]+=sig[:j-i]
def env(n,a,d,s_level=0.0,r=None):
    x=np.arange(n)/SR; e=np.minimum(1,x/max(a,1e-4))*np.exp(-np.maximum(0,x-a)/d)
    return e
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.zeros_like(x); acc=0.0
    # vectorized-ish via scipy-less loop on downsampled? keep loop
    for i in range(len(x)): acc=(1-a)*x[i]+a*acc; y[i]=acc
    return y
BEAT=0.5
# Chords Am F C G (2 beats? no, 4 beats each = 2s)
CH=[[57,60,64],[53,57,60],[48,55,64],[55,59,62]]
ROOT=[45,41,48,43]
# pad: detuned saws, 2s per chord, through whole piece, ends on C
pad=np.zeros(N)
for k in range(11):
    st=k*2.0
    idx=k%4
    if st>=18.0: idx=2   # resolve to C for outro
    ln=2.0 if st<18 else DUR-st
    n=int(ln*SR)+int(0.4*SR); x=np.arange(n)/SR
    sig=np.zeros(n)
    for m in CH[idx]+[CH[idx][0]+12]:
        for det in (-0.08,0.08):
            f=note(m+det)
            sig+=2*((x*f)%1)-1
    e=np.minimum(1,x/0.35)*np.minimum(1,np.maximum(0,(ln+0.4-x))/0.4)
    lvl=0.5 if st<2.5 else 1.0
    add('pad',st,sig*e*0.03*lvl)
mix['pad']=lp(mix['pad'],1400)
# hook plucks on each word (0.05+0.25i) ascending Am arpeggio, then "One app" hit at 1.9
def pluck(f,ln=0.6,bright=1.0):
    n=int(ln*SR); x=np.arange(n)/SR
    s=np.sin(2*np.pi*f*x)+0.35*bright*np.sin(2*np.pi*2*f*x)+0.12*bright*np.sin(2*np.pi*3*f*x)
    return s*np.exp(-x/0.18)*np.minimum(1,x/0.004)
for i,m in enumerate([69,72,76,79,81,84]):
    add('pluck',0.05+i*0.25,pluck(note(m))*0.22)
# arpeggio 8ths from 2.5 to 18
for k in range(int((18-2.5)/0.25)):
    st=2.5+k*0.25; ci=int(st//2)%4
    seq=CH[ci]+[CH[ci][1]+12]
    m=seq[k%4]+12
    add('pluck',st,pluck(note(m),0.4,0.6)*0.08)
# outro bell arpeggio on C
for i,m in enumerate([72,76,79,84]):
    add('pluck',18.0+i*0.25,pluck(note(m),1.2)*0.14)
# bass from 2.5
for k in range(int((18-2.5)/0.5)):
    st=2.5+k*0.5; ci=int(st//2)%4
    n=int(0.45*SR); x=np.arange(n)/SR
    f=note(ROOT[ci]-12)
    add('bass',st,(np.sin(2*np.pi*f*x)+0.2*np.sin(4*np.pi*f*x))*np.exp(-x/0.3)*np.minimum(1,x/0.01)*0.16)
add('bass',18.0,(lambda x:(np.sin(2*np.pi*note(36)*x))*np.exp(-x/1.2)*np.minimum(1,x/0.02)*0.2)(np.arange(int(3*SR))/SR))
# drums: kick on beats 5.5-18, soft hats offbeat
def kick():
    n=int(0.35*SR); x=np.arange(n)/SR
    f=50+90*np.exp(-x/0.04); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-x/0.12)
def hat():
    n=int(0.06*SR); x=np.arange(n)/SR
    w=rng.standard_normal(n); w=np.diff(w,prepend=0)
    return w*np.exp(-x/0.015)
for k in range(int((18-5.5)/0.5)):
    st=5.5+k*0.5
    add('drums',st,kick()*0.28)
    add('drums',st+0.25,hat()*0.035)
# impacts: reveal 2.5, outro 18
for st in (2.5,18.0): add('drums',st,kick()*0.35)
# fx: whooshes before transitions (filtered noise swell)
def whoosh(ln=0.45):
    n=int(ln*SR); x=np.arange(n)/SR
    w=rng.standard_normal(n); e=np.sin(np.pi*x/ln)**2
    return lp(w*e,1800)*0.6
for st in (2.15,5.2,9.75,14.75,17.7): add('fx',st,whoosh()*0.25)
# taps: soft click tuned to E6
def tap():
    n=int(0.12*SR); x=np.arange(n)/SR
    return (np.sin(2*np.pi*note(88)*x)*np.exp(-x/0.03)+0.3*rng.standard_normal(n)*np.exp(-x/0.004))
for st in (7.6,11.75,13.7): add('fx',st,tap()*0.09)
# typing ticks, very quiet
for k in range(14): add('fx',10.45+k*0.08,tap()[:int(0.03*SR)]*0.025)
# chimes: XP (E6,A6) and approve (C6 E6 G6)
def bell(f,ln=1.2):
    n=int(ln*SR); x=np.arange(n)/SR
    return (np.sin(2*np.pi*f*x)+0.4*np.sin(2*np.pi*2.76*f*x)*np.exp(-x/0.1))*np.exp(-x/0.45)*np.minimum(1,x/0.003)
for i,m in enumerate([88,93]): add('fx',7.75+i*0.09,bell(note(m))*0.07)
for i,m in enumerate([84,88,91]): add('fx',13.85+i*0.08,bell(note(m))*0.07)
# reverb (FFT conv with decaying noise IR)
def reverb(x,decay=1.6,wet=0.25):
    n=int(decay*SR); ir=rng.standard_normal(n)*np.exp(-np.arange(n)/SR/(decay/5)); ir/=np.sqrt((ir**2).sum())
    L=len(x)+n; F=1<<(L-1).bit_length()
    y=np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(ir,F),F)[:len(x)]
    return x*(1-wet)+y*wet
out=reverb(mix['pad'],2.0,0.3)+reverb(mix['pluck'],1.6,0.3)+mix['bass']+reverb(mix['drums'],0.8,0.1)+reverb(mix['fx'],1.6,0.35)
# sidechain-ish duck on kicks
duck=np.ones(N)
for k in range(int((18-5.5)/0.5)):
    i=int((5.5+k*0.5)*SR); n=int(0.25*SR); x=np.arange(n)/SR
    duck[i:i+n]=np.minimum(duck[i:i+n],1-0.25*np.exp(-x/0.08))
out*=duck
# fades and limiter
out*=np.minimum(1,t/0.02)*np.minimum(1,(DUR-t)/1.2)
out=np.tanh(out*1.6)/np.tanh(1.6)
out/=np.max(np.abs(out))*1.12
st=np.stack([out,np.roll(out,9)],1)
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((st*32767).astype(np.int16).tobytes()); w.close(); print('ok')
