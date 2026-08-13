import React from "react";
import useGame from "../../../../hooks/useGame";

const FileTable = () => {

    const files = useGame((state) => state.files)
    const selectedFileIndex = useGame((state) => state.selectedFileIndex)
    const setSelectedFileIndex = useGame((state) => state.setSelectedFileIndex)



    return (
        <table className="custom-table">
            <thead>
            <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Date</th>
            </tr>
            </thead>
            <tbody>
            {files.length > 0 ? (
                files.map((file,index) => (
                    <tr
                        className={selectedFileIndex === index ? "selected" : ""}
                        key={file.name}
                        onClick={() =>setSelectedFileIndex(index) }
                        onDoubleClick={() => window.open(file.url, "_blank")}
                        style={{ cursor: "pointer" }}
                    >
                        <td>{file.name}</td>
                        <td>{file.type}</td>
                        <td>{file.date}</td>
                    </tr>
                ))
            ) : (
                <tr>
                    <td colSpan="3" style={{ textAlign: "center" }}>
                        No files available
                    </td>
                </tr>
            )}
            </tbody>
        </table>
    );
};

export default FileTable;
