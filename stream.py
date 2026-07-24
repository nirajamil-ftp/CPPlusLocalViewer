import subprocess
from flask import Flask, Response

app = Flask(__name__)

@app.route('/')
def index():
    return open("index.html").read()

def gen():
    cmd = [
        'ffmpeg',
        '-rtsp_transport', 'tcp',
        '-i', 'rtsp://10.93.232.99:5543/live/channel0',
        '-an',
        '-c:v', 'mjpeg',
        '-q:v', '5',
        '-f', 'image2pipe',
        '-r', '20',
        '-'
    ]
    while True:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        data = b''
        try:
            while True:
                chunk = process.stdout.read(4096)
                if not chunk:
                    break
                data += chunk
                a = data.find(b'\xff\xd8')
                b = data.find(b'\xff\xd9')
                if a != -1 and b != -1:
                    jpg = data[a:b+2]
                    data = data[b+2:]
                    yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + jpg + b'\r\n')
        except Exception:
            break
        finally:
            process.terminate()
            process.wait()

@app.route('/video_feed')
def video_feed():
    return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, threaded=True)
