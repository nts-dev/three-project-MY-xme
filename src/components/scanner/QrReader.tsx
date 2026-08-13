import { useEffect, useRef, useState } from "react";

// Styles
import "./QrStyles.css";
import QrScanner from "qr-scanner";
import useGame from "../../hooks/useGame";
import database from "../../database";
import {Q} from "@nozbe/watermelondb";
import {Toast} from "primereact/toast";
import * as React from "react";

const QrReader = () => {
  // QR States
  const scanner = useRef<QrScanner>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const qrBoxEl = useRef<HTMLDivElement>(null);
  const [qrOn, setQrOn] = useState<boolean>(true);
  const setScanner = useGame((state: any) => state.setScanner);
  const [scannedResult, setScannedResult] = useState<string | undefined>("");
  const setProjectID: any = useGame((state: any) => state.setProjectID);
  const setScannedId: any = useGame((state: any) => state.setScannedId);
  const setScan: any = useGame((state: any) => state.setScan);
  const scan: boolean = useGame((state: any) => state.scan);
  const toast = useRef(null);
  // Success
  const onScanSuccess = async (result: QrScanner.ScanResult) => {

    // @ts-ignore
    const assetDt = !isNaN(result?.data) ? parseInt(result?.data) : parseInt(result?.data?.match(/asset=(\d+)/)[1]);

    const assetId = assetDt

    const assetCollection = database.collections.get('assets');
    const asset: any = await assetCollection.query(Q.where('instance_id', assetId)).fetch();
    const pId = asset[0]?.category.split('-')[0]


    if(pId===undefined){

      if (toast.current) { // @ts-ignore
        toast.current.show({
          severity: 'error',
          summary: 'Asset not found!',
          detail: `Asset not found in a project`,
          life: 30000
        });
      }
      return
    }

    if(parseInt(pId)>0){
      setProjectID(parseInt(pId))

    }


    if (assetId) {

      setScannedId(assetId)
      setScanner(false)
      setScan(!scan)
    }

    setScannedResult(result?.data);

  };

  // Fail
  const onScanFail = (err: string | Error) => {
    // 🖨 Print the "err" to browser console.
    console.log(err);
  };

  useEffect(() => {

    if ( videoEl?.current && !scanner.current) {
      // 👉 Instantiate the QR Scanner
      scanner.current = new QrScanner(videoEl?.current, onScanSuccess, {
        onDecodeError: onScanFail,
        // 📷 This is the camera facing mode. In mobile devices, "environment" means back camera and "user" means front camera.
        preferredCamera: "environment",
        // 🖼 This will help us position our "QrFrame.svg" so that user can only scan when qr code is put in between our QrFrame.svg.
        highlightScanRegion: true,
        // 🔥 This will produce a yellow (default color) outline around the qr code that we scan, showing a proof that our qr-scanner is scanning that qr code.
        highlightCodeOutline: true,
        // 📦 A custom div which will pair with "highlightScanRegion" option above 👆. This gives us full control over our scan region.
        overlay: qrBoxEl?.current || undefined,
      });

      // 🚀 Start QR Scanner
      scanner?.current
        ?.start()
        .then(() => setQrOn(true))
        .catch((err) => {
          if (err) setQrOn(false);
        });
    }

    // 🧹 Clean up on unmount.
    // 🚨 This removes the QR Scanner from rendering and using camera when it is closed or removed from the UI.
    return () => {
      if (!videoEl?.current) {
        scanner?.current?.stop();
      }
    };
  }, [videoEl]);

  // ❌ If "camera" is not allowed in browser permissions, show an alert.
  useEffect(() => {
    if (!qrOn)
      alert(
        "Camera is blocked or not accessible. Please allow camera in your browser permissions and Reload."
      );
  }, [qrOn]);

  return (

    <div className="qr-reader">
      <Toast ref={toast}/>
      {/* QR */}
      <video ref={videoEl}></video>
      <div ref={qrBoxEl} className="qr-box">
        <img
          src={`${import.meta.env.VITE_FILE_URL}/qr-frame.svg`}
          alt="Qr Frame"
          width={256}
          height={256}
          className="qr-frame"
        />
      </div>

      {/* Show Data Result if scan is success */}
      {scannedResult && (
        <p
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 99999,
            color: "white",
          }}
        >
          Scanned Result: {scannedResult}
        </p>
      )}
    </div>

  );
};

export default QrReader;
