import * as React from 'react';
import { useEffect, useState } from 'react';
import { Tree } from 'primereact/tree';
import { useDispatch, useSelector } from 'react-redux';
import useGame from "../../../hooks/useGame";
import { useGetDataQuery } from "../../../features/data/data";
import { setNodes, updateNodeChildren } from "../../../features/videoNodes/nodeSlice";

export default function ChannelsView() {
    const dispatch = useDispatch();
    const nodes = useSelector((state: any) => state.node.nodes);  // Select nodes from Redux state

    const [selectedNodeKey, setSelectedNodeKey] = useState<any>('');
    const setShowVideo: any = useGame((state: any) => state.setShowVideo);
    const setVideoLink: any = useGame((state: any) => state.setvideoLink);
    const setvideoRawLink: any = useGame((state: any) => state.setvideoRawLink);


    const { data, error, isLoading } = useGetDataQuery(`/videoCategories`);

    useEffect(() => {
        if (data) {
            // @ts-ignore
            dispatch(setNodes(data));  // Set the fetched nodes into Redux state
            // setLoading(true);
        }
    }, [data, dispatch]);

    const loadOnExpand = async (event: any) => {
        // setLoading(true);
        const {key, children} = event.node;
        const [id, pIndex, index, cId] = key.split('_');

        if (!children || children.length === 0) {
            // setLoading(true);
            try {
                let subCatData: any = [];
                if (cId) {
                    // Fetch videos (third-level nodes)
                    const response = await fetch(`${import.meta.env.VITE_API_URL}/videos/${key}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                    // const response = await fetch(`${process.env.REACT_APP_API_URL}/videos/${key}`);
                    subCatData = await response.json();

                } else {
                    // Fetch subcategories/modules (second-level nodes)
                    const response = await fetch(`${import.meta.env.VITE_API_URL}/modules/${key}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                    // const response = await fetch(`${process.env.REACT_APP_API_URL}/modules/${key}`);
                    subCatData = await response.json();
                }

                if(subCatData.length){
                    dispatch(updateNodeChildren({key: event.node.key, children: subCatData}));
                }

            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                // setLoading(false);
            }
        }
    }

    const onSelect = (event: any) => {
        if (event.node.data === "" || !event.node.raw_link) return;
        setShowVideo(true);
        setvideoRawLink(event.node.raw_link)
        setVideoLink(event.node.data);
    };

    return (
        <div className="card flex justify-content-center channel " >
            <Tree value={nodes} onExpand={loadOnExpand} onSelect={onSelect}
                  selectionMode="single"
                  filter filterMode="lenient"
                  filterPlaceholder="Search video here..."
                  selectionKeys={selectedNodeKey}
                  onSelectionChange={(e) => setSelectedNodeKey(e.value)}
                  loading={isLoading} className="w-full md:w-30rem document-tree"
                  style={{fontSize: '0.5rem'}}/>
        </div>
    );
}
