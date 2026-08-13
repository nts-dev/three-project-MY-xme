import React, {useEffect,  useState} from "react";
import InstanceAnimation from "./InstanceAnimation";


const AnimatedInstance = ({ instanceData }) => {
    const [instances, setInstances] = useState([])

    useEffect(() => {
        setInstances(instanceData)

    }, []);

    return instances.map(({ key, data, name, object, animations }) => (
        <InstanceAnimation
            key={key}
            data={data}
            name={name}
            object={object}
            animations={animations}
        />
    ));


};

export default AnimatedInstance;
