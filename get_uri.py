from onvif import ONVIFCamera
try:
    print("कैमरे से कनेक्ट हो रहे हैं...")
    mycam = ONVIFCamera('10.93.232.99', 8000, 'admin', 'Krishna123')
    media_service = mycam.create_media_service()
    profiles = media_service.GetProfiles()
    token = profiles[0].token
    request = media_service.create_type('GetStreamUri')
    request.ProfileToken = token
    request.StreamSetup = {'Stream': 'RTP-Unicast', 'Transport': {'Protocol': 'RTSP'}}
    uri = media_service.GetStreamUri(request)
    print("\n[+] असली RTSP लिंक मिल गया है:")
    print(uri.Uri)
except Exception as e:
    print("\n[-] एरर आया:", e)
