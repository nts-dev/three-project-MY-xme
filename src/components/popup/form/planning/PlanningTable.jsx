
import React, { useEffect } from "react";
import useGame from "../../../../hooks/useGame";


const PlanningTable = () => {
    const logs = useGame((state) => state.logs);
    const selectedLogIndex = useGame((state) => state.selectedLogIndex);
    const setSelectedLogIndex = useGame((state) => state.setSelectedLogIndex);
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    // Debugging: Log changes to logs

    return (
        <div key={`${selectedAssetId}_inner_table`} className="table-container">
            <table className="custom-table">
                <thead>
                <tr>
                    <th>Name</th>
                    <th>Start</th>
                    <th>End</th>
                </tr>
                </thead>
                <tbody>
                {logs.length > 0 ? (
                    logs.map((log, index) => (
                        <tr
                            key={log.id || index} // Ensure a unique key
                            className={selectedLogIndex === index ? "selected" : ""}
                            style={{ cursor: "pointer" }}
                            onClick={() => setSelectedLogIndex(index)}
                        >
                            <td>{log.name}</td>
                            <td>{log.startDate}</td>
                            <td>{log.endDate}</td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="3" style={{ textAlign: "center" }}>
                            No event
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
};

export default PlanningTable;
