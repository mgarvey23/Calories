import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

interface BarcodeScannerProps {
  /** Called with the decoded barcode string once a code is read. */
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

/**
 * Full-screen camera overlay that scans product barcodes (EAN/UPC) using the
 * device camera. Works on phones over HTTPS (and on localhost). Prefers the
 * rear-facing camera.
 */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Camera access is not available in this browser.');
          return;
        }
        const controls = await reader.decodeFromVideoDevice(
          undefined, // let the browser pick; constraints below prefer the rear camera
          videoRef.current!,
          (result, _err, ctrl) => {
            if (result && !cancelled) {
              ctrl.stop();
              onDetected(result.getText());
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (err) {
        if (cancelled) return;
        const name = (err as Error).name;
        if (name === 'NotAllowedError') {
          setError('Camera permission was denied. Allow camera access and try again.');
        } else if (name === 'NotFoundError') {
          setError('No camera was found on this device.');
        } else {
          setError('Could not start the camera.');
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  return (
    <div className="scanner-overlay">
      <div className="scanner-panel">
        <header className="scanner-header">
          <span>Scan a barcode</span>
          <button className="remove-button" onClick={onClose} aria-label="Close scanner">×</button>
        </header>

        {error ? (
          <div className="scanner-error">{error}</div>
        ) : (
          <div className="scanner-viewport">
            <video ref={videoRef} className="scanner-video" muted playsInline />
            <div className="scanner-reticle" />
          </div>
        )}

        <p className="scanner-hint">Point the camera at the product's barcode.</p>
      </div>
    </div>
  );
}
