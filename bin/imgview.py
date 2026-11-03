import base64, os, struct, sys, termios, tty, fcntl
path = sys.argv[1]
data = open(path, 'rb').read()
w, h = struct.unpack('>II', data[16:24])
rows, cols = struct.unpack('HHHH', fcntl.ioctl(1, termios.TIOCGWINSZ, b'\0' * 8))[:2]
xp, yp = struct.unpack('HHHH', fcntl.ioctl(1, termios.TIOCGWINSZ, b'\0' * 8))[2:]
cw = (xp / cols) if xp else 8.0
ch = (yp / rows) if yp else 16.0
avail_c, avail_r = cols, rows - 2
scale = min(avail_c * cw / w, avail_r * ch / h)
c = max(1, int(w * scale / cw)); r = max(1, int(h * scale / ch))
out = sys.stdout.buffer
out.write(b'\x1b[2J\x1b[H\x1b[?25l')
pad = max(0, (cols - c) // 2)
out.write(b' ' * pad)
b64 = base64.standard_b64encode(data)
first = True
for i in range(0, len(b64), 4096):
    chunk = b64[i:i + 4096]; more = 1 if i + 4096 < len(b64) else 0
    ctrl = (f'a=T,f=100,c={c},r={r},q=2,m={more}' if first else f'm={more}').encode()
    out.write(b'\x1b_G' + ctrl + b';' + chunk + b'\x1b\\'); first = False
out.write(f'\x1b[{rows};1H{os.path.basename(path)}  {w}x{h}   按任意鍵關閉'.encode())
out.flush()
fd = sys.stdin.fileno(); old = termios.tcgetattr(fd)
try:
    tty.setraw(fd); os.read(fd, 1)
finally:
    termios.tcsetattr(fd, termios.TCSADRAIN, old)
    out.write(b'\x1b_Ga=d\x1b\\\x1b[?25h\x1b[2J'); out.flush()
