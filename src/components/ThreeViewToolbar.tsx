import  {useEffect} from 'react'
import useGame from "../hooks/useGame";
import ThreeViewMenuBar from "./ThreeViewMenuBar";
import ThreeViewSearch from "./ThreeViewSearch";
import IconMenu from "./puzzle-game/IconMenu";


export const ThreeViewToolbar: any = ({scene}: any) => {
    const setToggleSideBar: any = useGame((state: any) => state.setToggleSideBar)
    const toggleSideBar: string = useGame((state: any) => state.toggleSideBar)
    const darkTheme = useGame((state: any) => state.darkTheme);
    // const buttonMode = useGame((state: any) => state.buttonMode);
    // const toolBarHidden: boolean = useGame((state: any) => state.toolBarHidden);
    const projectId: number = useGame((state: any) => state.projectID)
    const setAssetEdit = useGame((state: any) => state.setAssetEdit);
    const isPuzzleGame = useGame((state: any) => state.isPuzzleGame);
    useEffect(() => {
        if(projectId==147){
            setAssetEdit(true)
        }
    }, [projectId]);

    const handleClickSidebar = () => {
        if (toggleSideBar == '')
            setToggleSideBar('-translate-x-full')
        else {
            setToggleSideBar('')
        }
    }

    return (

        <div className={` text-gray-700 flex items-center  shadow-md justify-start`}
             style={{ background: darkTheme?'#282c34': '#fff',
                      boxShadow: 'inset 0 0 2px rgba(16, 17, 16, 0.5)',
                       // display: toolBarHidden  ? 'none': 'flex'
                       display:  'flex', zIndex: '999999'

        }
        }
        >
            <div className='flex items-center menu-bar-top' >
                <button className=" t-button focus:outline-none " onClick={handleClickSidebar}>
                    <svg className="h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                </button>
                <ThreeViewSearch/>
            </div>
            { isPuzzleGame ? <IconMenu scene={scene}/>: <ThreeViewMenuBar/> }
        </div>

    )
}
