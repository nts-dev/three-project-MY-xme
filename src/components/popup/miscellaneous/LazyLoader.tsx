import { BlockUI } from 'primereact/blockui';

import useGame from "../../../hooks/useGame";


export default function LazyLoader() {
    const lazy: boolean = useGame((state: any) => state.lazy)
    const lazyMsg: string = useGame((state: any) => state.lazyMsg)



   
    // if (isPuzzleGame) {
    //     return null;
    // }

    // return (<BlockUI blocked={lazy} template={lazyMsg} style={{ fontSize: '2rem', color: '#343434' }} fullScreen />)
    return (
        <BlockUI
            blocked={lazy}
            template={(
                <div className="app-lazy-loader">
                    <i className="pi pi-spin pi-spinner" aria-hidden="true"></i>
                    <span>{lazyMsg || 'Please wait...'}</span>
                </div>
            )}
            fullScreen
        />
    )
}
