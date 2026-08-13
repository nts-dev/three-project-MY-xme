
import {useSelector} from "react-redux";



export default function HtmlData(){
    const htmlContent = useSelector((state: any) => state.menu.htmlContent);

    if(htmlContent == undefined || !htmlContent || htmlContent=='undefined'|| htmlContent.trim().length === 0){
        return <div className='flex items-center justify-content-center '>
            No info data
        </div>
    }
    return (
        <>
         <div
             dangerouslySetInnerHTML={{__html: htmlContent}}
              className="popup-html"
        />
        </>
    )
}
