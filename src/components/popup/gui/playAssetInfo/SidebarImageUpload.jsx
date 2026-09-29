import React, { useRef, useState } from "react";
import { FaCamera } from "react-icons/fa";
import { parseImageUploadResponse } from "./parseImageUploadResponse.js";

const UPLOAD_URL = "https://bo8.nts.nl/network/Controller/php/data_files.php?action=6&type=image";

export default function SidebarImageUpload({ instanceId, onUploaded }) {
    const inputRef = useRef(null);
    const sideRef = useRef("");
    const busyRef = useRef(false);
    const [choosingSide, setChoosingSide] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const chooseSide = (side) => {
        sideRef.current = side;
        inputRef.current.click();
    };

    const upload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || busyRef.current) return;
        setError("");
        setMessage("");
        if (!file.type.startsWith("image/")) {
            setError("Please choose an image file.");
            return;
        }
        if (!instanceId || !sideRef.current) return;
        busyRef.current = true;
        setUploading(true);
        try {
            const url = new URL(UPLOAD_URL);
            url.searchParams.set("position", "top");
            url.searchParams.set("id", String(instanceId));
            url.searchParams.set("asset", String(instanceId));
            url.searchParams.set("mode", "html5");
            url.searchParams.set("side", sideRef.current);
            const body = new FormData();
            body.append("file", file, file.name);
            const response = await fetch(url.toString(), { method: "POST", body });
            if (!response.ok) throw new Error(`Upload failed (HTTP ${response.status}).`);
            const text = await response.text();
            const result = parseImageUploadResponse(text);
            if (!result || result.error || result.state === false || result.success === false || result.response === false || ["cancelled", "error", "failed"].includes(String(result.state || "").toLowerCase())) {
                throw new Error(typeof result?.error === "string" ? result.error : "The server could not save the image.");
            }
            setMessage("Image uploaded.");
            setChoosingSide(false);
            onUploaded(result);
        } catch (err) {
            setError(err.message || "Upload failed. Please try again.");
        } finally {
            busyRef.current = false;
            setUploading(false);
        }
    };

    return (
        <div className="play-asset-info__image-upload">
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={upload} />
            {!choosingSide ? (
                <div className="play-asset-info__upload-actions">
                    <button type="button" disabled={!instanceId} onClick={() => { setChoosingSide(true); setMessage(""); setError(""); }}>
                        <FaCamera aria-hidden="true" /> Upload Image
                    </button>
                </div>
            ) : (
                <div role="group" aria-label="Choose image side">
                    <p>Choose image side</p>
                    <div className="play-asset-info__upload-actions">
                        <button type="button" disabled={uploading} onClick={() => chooseSide("front")}>Front</button>
                        <button type="button" disabled={uploading} onClick={() => chooseSide("back")}>Back</button>
                        <button type="button" disabled={uploading} onClick={() => setChoosingSide(false)}>Cancel</button>
                    </div>
                </div>
            )}
            {(uploading || message) && <p role="status">{uploading ? "Uploading image..." : message}</p>}
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
