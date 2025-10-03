import { useEffect, useRef } from 'react'
import useWebSocket from 'react-use-websocket'
import throttle from 'lodash.throttle'




// let data = {
//     devicename:{
//         vitals:{
//             bodyTemp:36.6,
//             heartRate:23
//         },
//         environment:{
//             carbonMonoxide:12,
//             ammonia:34,
//             hydrogenSulfide:34,
//             sulphurDioxide:34,
//             nitrogenDioxide:23,
//             methane: 23,
//             temperature:43,
//             pressure: 34,
//             humidity:56
//         }
//     }
// }




export function Home({username}){

    const WS_URL = 'ws://127.0.0.1:8000'

    const {sendJsonMessage, lastJsonMessage} = useWebSocket(WS_URL,{
        queryParams:{username}
    })

    const THROTTLE = 50;
    const sendJsonMessageThrottled = useRef(throttle(sendJsonMessage, THROTTLE))

    useEffect(()=>{
        sendJsonMessage({
            x:0,
            y:0
        })
        window.addEventListener("mousemove", e=>{
            sendJsonMessageThrottled.current({
                x: e.clientX,
                y: e.clientY
            })
        })
    },[])

    if(lastJsonMessage){
        return <>
            {renderCursors(lastJsonMessage)}
        </>
    }
    return(
        <h1>Welcome {username}</h1>
    )
}