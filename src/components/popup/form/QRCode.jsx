
import React from "react";

export default function QRCode({ id, name,qrData }) {
    const targetUrl = `https://bo.nts.nl/scanner-info/?asset=${id}`; // Change this to your actual URL
    const qrServerUrl = `https://api.qrserver.com/v1/create-qr-code/?size=189x189&data=${encodeURIComponent(targetUrl)}`;

    return (
        <div key={id} className="flex flex-column items-center justify-content-center p-2">
            <div className="flex align-middle justify-content-center w-50">
                <img src={qrServerUrl} alt={id} />
            </div>
            <div className="flex flex-column p-2 w-100">
                <a
                    style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textDecoration: "underline",
                        color: "rgb(13, 110, 253)",
                    }}
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {targetUrl}
                </a>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                    <tr>
                        <td><b>Description</b></td>
                        <td>{name}</td>
                    </tr>
                    <tr>
                        <td><b>Asset ID</b></td>
                        <td>{id}</td>
                    </tr>
                    {Array.isArray(qrData) &&
                        qrData.map((item) => (
                            <tr key={item.fieldId}>
                                <td><b>{item.name}</b></td>
                                <td>{item.value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

}
