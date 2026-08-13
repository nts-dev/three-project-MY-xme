export default function HelperMessage(msgs: any, header: string, text: string, htmlCode:string,timout: number = 10000){

        msgs.current.clear();
        msgs.current.show([
            {
                life: timout,
                closable: false,
                detail: (
                    <div id='notification' className="game-dialog-token .p-dialog-content-info">
                        {/* Close Button */}
                        <button
                            className="info-close-button"
                            onClick={() => msgs.current?.clear()}
                        >
                            &#10005; {/* Unicode X icon */}
                        </button>

                        <div style={{ display: 'flex', gap: '12px',  flexDirection: 'column', alignItems: 'center', padding: '0.8rem' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    // flexDirection: 'column',
                                    gap: '10px',
                                    width: '100%',
                                    alignItems: 'center', // Center the content horizontally
                                    justifyContent: 'center'
                                }}
                            > 
                            <div style={{ fontSize: '24px', color: '#edf1ed' }}>
                                <div dangerouslySetInnerHTML={{ __html: htmlCode }} />
                                {/*&#x2328; /!* Unicode keyboard icon *!/*/}
                            </div>
                                <p
                                    style={{
                                    
                                        color: 'white',
                                        textAlign: 'center', // Center the text
                                        // width: '100%', // Ensure the text takes full width
                                    }}
                                >
                                    {header}
                                </p>
</div>

                                <div
                                   className="p-dialog-content-info"
                                >
                                    <div dangerouslySetInnerHTML={{ __html: text }} />
                                
                            </div>
                        </div>
                    </div>
                )
            },

        ]);


}
