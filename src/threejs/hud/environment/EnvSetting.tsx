import React from 'react';
import { OverlayPanel } from 'primereact/overlaypanel';
import { TabView, TabPanel } from 'primereact/tabview';
import useGame from "../../../hooks/useGame";
import ProjectControls from "../../environment/ProjectControls";
import PlayerControls from "../../player/PlayerControls";
import EnvironmentControls from "./EnvironmentControls";

export default function EnvSetting({ op }: any) {
    const projectId: number = useGame((state: any) => state.projectID)
    const character: any = useGame((state: any) => state.character)
    const firstPerson: any = useGame((state: any) => state.firstPerson)
    return (
        <div className="card flex justify-content-center">

            <OverlayPanel ref={op} className="tool-window">

                <TabView className="custom-tabview">
                    <TabPanel header="Project">
                        {
                            projectId ? <ProjectControls/> :
                                <p>Project not selected...</p>
                        }
                    </TabPanel>
                    <TabPanel header="Player">
                        {(character || firstPerson) ? < PlayerControls/> : <p>Player controls not enabled...</p>}

                    </TabPanel>
                    <TabPanel header="Environment">
                        <EnvironmentControls/>
                        {/*<p>Environment settings content goes here...</p>*/}
                    </TabPanel>

                </TabView>

            </OverlayPanel>

        </div>
    );
}
