import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export default create(subscribeWithSelector((set) =>
{
    return {
        blocksCount: 10,
        blocksSeed: 0,

        /**
         * Time
         */
        startTime: 0,
        endTime: 0,

        /**
         * Phases
         */
        phase: 'ready',

        start: () =>
        {
            set((state) =>
            {
                if(state.phase === 'ready'|| state.phase === 'init')
                    return { phase: 'playing', startTime: Date.now() }

                return {}
            })
        },
        ready: () =>
        {
            set((state) =>
            {
                if(state.phase === 'ready')
                    return { phase: 'init', startTime: Date.now() }

                return {}
            })
        },

        restart: () =>
        {
            set((state) =>
            {
                if(state.phase === 'playing' || state.phase === 'ended'|| state.phase === 'timeout')
                     return { phase: 'ready', blocksSeed: Math.random() }

                return {}
            })
        }
        ,
        end: () =>
        {
            set((state) =>
            {
                if(state.phase === 'playing')
                    return { phase: 'ended', endTime: Date.now() }

                return {}
            })
        },
        timeout: (isRecovering) =>
        {
            set((state) =>
            {
                if(state.phase === 'timeout' && isRecovering)
                    return { phase: 'playing', endTime: Date.now() }

                if(state.phase === 'playing' && !isRecovering)
                    return { phase: 'timeout', endTime: Date.now() }

                return {}
            })
        }
    }
}))
