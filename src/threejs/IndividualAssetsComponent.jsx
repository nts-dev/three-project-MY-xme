

import { useState, useEffect } from "react";
import {IndividualAsset} from "./IndividualAsset.jsx";

export default function IndividualAssetsComponent({ instanceData }) {
    const [data, setData] = useState([]);


    // Optimize useEffect with a single dependency check
    useEffect(() => {
        setData(instanceData || []);
    }, [instanceData]);


    return (
        <>
            {data.map(item => (
                    <IndividualAsset
                        key={item.key}
                        data={item}

                    />
                ))}
        </>
    );
}