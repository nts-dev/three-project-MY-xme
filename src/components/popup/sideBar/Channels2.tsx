import * as React from 'react';
import {useEffect} from 'react';
import {Sidebar} from 'primereact/sidebar';
import useGame from "../../../hooks/useGame";
import ChannelsView from "./ChannelsView";

export default function Channels2() {
    const channel: boolean = useGame((state: any) => state.channel)
    const setChannel: any = useGame((state: any) => state.setChannel)
    const channelEvent: any = useGame((state: any) => state.channelEvent)

    useEffect(() => {
        if (channelEvent == null) {
            return
        }
        const event = channelEvent.originalEvent.target.parentNode
        if (event.tagName == "DIV") {
            channel ? event.classList.add('box-shadow') : event.classList.remove('box-shadow')
        } else {
            channel ? event.parentNode.classList.add('box-shadow') : event.parentNode.classList.remove('box-shadow')

        }
    }, [channel])


    const customHeader = (
        <div className="flex align-items-center gap-2">
               <span style={{fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px'}}>
                    NTS Channels
                </span>
        </div>
    );

    return (
            <Sidebar
                header={customHeader}
                visible={channel}
                position="right"
                className="categories"
                onHide={() => setChannel(false)}
            >
                <ChannelsView/>
            </Sidebar>

    )
}
