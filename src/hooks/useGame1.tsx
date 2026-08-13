import * as THREE from "three";
import {create} from "zustand";
import {subscribeWithSelector} from "zustand/middleware";

// Define the State type and AnimationSet type
type State = {
    moveToPoint: THREE.Vector3;
    isCameraBased: boolean;
    curAnimation: string;
    jumpDuration: number;
    jumpTransitionTimer: ReturnType<typeof setTimeout> | null;
    animationSet: AnimationSet;
    initializeAnimationSet: (animationSet: AnimationSet) => void;
    setJumpDuration: (durationMs: number) => void;
    reset: () => void;
    setMoveToPoint: (point: THREE.Vector3) => void;
    getMoveToPoint: () => {
        moveToPoint: THREE.Vector3;
    };
    setCameraBased: (isCameraBased: boolean) => void;
    getCameraBased: () => {
        isCameraBased: boolean;
    };
    blocksCount: number
    blocksSeed: number
    startTime: number
    endTime: number
    phase: string
    start: () => void
    restart: () => void
    end: () => void
} & {
    [key in keyof AnimationSet]: () => void;
};

export const useGame1 = create<State>()(subscribeWithSelector((set, get) => {
        const initialMoveToPoint = new THREE.Vector3(0, 0, 0);
        const clearJumpTimer = (timer: ReturnType<typeof setTimeout> | null) => {
            if (timer) clearTimeout(timer);
        };
        const sameAnimationState = (
            state: any,
            targetAnimation: string | undefined,
            resetJumpTimer: boolean = false
        ) => {
            if (!targetAnimation) return {};
            if (state.curAnimation !== targetAnimation) return null;
            if (resetJumpTimer && state.jumpTransitionTimer) {
                clearJumpTimer(state.jumpTransitionTimer);
                return {jumpTransitionTimer: null};
            }
            return {};
        };
        return {
            moveToPoint: initialMoveToPoint,
            isCameraBased: false,
            curAnimation: 'Idle',
            jumpDuration: 650,
            jumpTransitionTimer: null,
            animationSet: {} as AnimationSet,
            blocksCount: 10,
            blocksSeed: 0,
            phase: 'ready',

            /**
             * Time
             */
            startTime: 0,
            endTime: 0,
            start: () => {
                set((state: any) => {
                    if (state.phase === 'ready')
                        return {phase: 'playing', startTime: Date.now()}

                    return {}
                })
            },
            restart: () => {
                set((state: any) => {
                    if (state.phase === 'playing' || state.phase === 'ended')
                        return {phase: 'ready', blocksSeed: Math.random()}

                    return {}
                })
            },

            end: () => {
                set((state: any) => {
                    if (state.phase === 'playing')
                        return {phase: 'ended', endTime: Date.now()}

                    return {}
                })
            },


            initializeAnimationSet: (animationSet: AnimationSet) => {
                set((state: any) => {
                    if (Object.keys(state.animationSet).length === 0) {
                        return {animationSet};
                    }
                    return {};
                });
            },
            setJumpDuration: (durationMs: number) => {
                set(() => ({
                    jumpDuration: Math.max(0, durationMs || 0),
                }));
            },

            reset: () => {

                set((state: any) => {
                    clearJumpTimer(state.jumpTransitionTimer);
                    return {
                        curAnimation: state.animationSet.idle,
                        jumpTransitionTimer: null,
                    };
                });
            },

            idle: () => {

                set((state: any) => {
                    clearJumpTimer(state.jumpTransitionTimer);
                    // if (state.curAnimation === state.animationSet.jump) {
                    //     return {curAnimation: state.animationSet.jumpDown};
                    // }
                    if (state.curAnimation === state.animationSet.jump) {
                        return {curAnimation: state.animationSet.jumpDown};
                    }
                    if (state.curAnimation === state.animationSet.recover) {
                        return {
                            curAnimation: state.animationSet.recover,
                            jumpTransitionTimer: null,
                        };
                    }

                    const unchanged = sameAnimationState(state, state.animationSet.idle);
                    if (unchanged) return unchanged;

                        return {
                            curAnimation: state.animationSet.idle,
                            jumpTransitionTimer: null,
                        };

                });
            },
           push: () => {

                set((state: any) => {
                    // if (state.curAnimation === state.animationSet.jump) {
                    //     return {curAnimation: state.animationSet.jumpDown};
                    // }
                    if (state.curAnimation === state.animationSet.recover) {
                        return {curAnimation: state.animationSet.recover};
                    }
                    const unchanged = sameAnimationState(state, state.animationSet.push);
                    if (unchanged) return unchanged;
                     if (state.curAnimation === state.animationSet.walk) {
                        return {curAnimation: state.animationSet.push};
                    }
                        return {curAnimation: state.animationSet.push};

                });
            },
           upstairs: () => {

                set((state: any) => {
                    // if (state.curAnimation === state.animationSet.jump) {
                    //     return {curAnimation: state.animationSet.jumpDown};
                    // }
                    // if (state.curAnimation === state.animationSet.recover) {
                    //     return {curAnimation: state.animationSet.recover};
                    // }
                    //  if (state.curAnimation === state.animationSet.walk) {
                    //     return {curAnimation: state.animationSet.push};
                    // }
                    const unchanged = sameAnimationState(state, state.animationSet.upstairs);
                    if (unchanged) return unchanged;
                    return {curAnimation: state.animationSet.upstairs};

                });
            },
            walk: () => {
                set((state: any) => {
                    const { animationSet, curAnimation } = state;
                    // --- 1. If recovering, never interrupt it ---
                    if (curAnimation === animationSet.recover) {
                     
                        return {
                            curAnimation: animationSet.walk,
                            jumpTransitionTimer: null,
                        };
                        // return { curAnimation: animationSet.recover };
                    }

                    // --- 2. If currently jumping ---
                    if (curAnimation === animationSet.jump) {

            
                        return {
                            curAnimation: animationSet.walk
                            //  return {curAnimation: state.animationSet.jumpDown};
                            
                        };
                    }

                    // --- 3. If falling/landing: move to walk ---
                    if (curAnimation === animationSet.jumpDown) {
                    
                        return {
                            curAnimation: animationSet.walk
                            
                        };
                    }

                    const unchanged = sameAnimationState(state, animationSet.walk);
                    if (unchanged) return unchanged;

            
                    return {
                        curAnimation: animationSet.walk
                        
                    };
                });
            },

            run: () => {
                set((state: any) => {

                    // if (state.curAnimation === state.animationSet.jump) {
                    //     return { curAnimation: state.animationSet.jump };
                    //     // return {curAnimation: 'Walk'};
                    // }
                    if (state.curAnimation === state.animationSet.jump) {
                        return {  curAnimation: state.animationSet.run };
                    }
                    if (state.curAnimation === state.animationSet.jumpDown) {
                  
                        return {
                            curAnimation: state.animationSet.run,
                            jumpTransitionTimer: null,
                        };
                    }

                    const unchanged = sameAnimationState(state, state.animationSet.run, true);
                    if (unchanged) return unchanged;
          
                    return {
                        curAnimation: state.animationSet.run,
                        jumpTransitionTimer: null,
                    };
                });
            },

            jump: () => {
                set((state: any) => {
                    const unchanged = sameAnimationState(state, state.animationSet.jump);
                    if (unchanged) return unchanged;
                    return {
                        curAnimation: state.animationSet.jump,
                    };
                });
            },

            jumpIdle: () => {
                set((state: any) => {
                    if (state.curAnimation === state.animationSet.jump) {
                        return {curAnimation: state.animationSet.jumpIdle};
                    }
                    return {};
                });
            },

            jumpLand: () => {
                set((state: any) => {
                    if (state.curAnimation === state.animationSet.jumpIdle) {
                        return {curAnimation: state.animationSet.jumpLand};
                    }
                    return {};
                });
            },

            fall: () => {
                set((state: any) => {
                    const unchanged = sameAnimationState(state, state.animationSet.fall);
                    if (unchanged) return unchanged;
                    return {curAnimation: state.animationSet.fall};
                });
            },
            fail: () => {
                set((state: any) => {
                 
                    return {curAnimation: state.animationSet.fail};
                });
            },
            recover: () => {
                set((state: any) => {
                    const unchanged = sameAnimationState(state, state.animationSet.recover);
                    if (unchanged) return unchanged;
                    return {curAnimation: state.animationSet.recover};
                });
            },

            climb: () => {
                set((state: any) => {
                    clearJumpTimer(state.jumpTransitionTimer);
                    const unchanged = sameAnimationState(state, state.animationSet.climb);
                    if (unchanged) return unchanged;
                    return {
                        curAnimation: state.animationSet.climb,
                        jumpTransitionTimer: null,
                    };
                });
            },
            left: () => {
                set((state: any) => {

                    clearJumpTimer(state.jumpTransitionTimer);
                    const unchanged = sameAnimationState(state, state.animationSet.left);
                    if (unchanged) return unchanged;
                    return {
                        curAnimation: state.animationSet.left,
                        jumpTransitionTimer: null,
                    };
                });
            },
            right: () => {
                set((state: any) => {

                    clearJumpTimer(state.jumpTransitionTimer);
                    const unchanged = sameAnimationState(state, state.animationSet.right);
                    if (unchanged) return unchanged;
                    return {
                        curAnimation: state.animationSet.right,
                        jumpTransitionTimer: null,
                    };
                });
            },
            jumpDown: () => {
                set((state: any) => {
                    clearJumpTimer(state.jumpTransitionTimer);
                    const unchanged = sameAnimationState(state, state.animationSet.jumpDown);
                    if (unchanged) return unchanged;
                    return {
                        curAnimation: state.animationSet.jumpDown,
                        jumpTransitionTimer: null,
                    };
                });
            },
            levitate: () => {
                set((state: any) => {
                    const unchanged = sameAnimationState(state, state.animationSet.levitate);
                    if (unchanged) return unchanged;
                    return {curAnimation: state.animationSet.levitate};
                });
            },

            action1: () => {
                set((state: any) => {
                    if (state.curAnimation === state.animationSet.idle) {
                        return {curAnimation: state.animationSet.action1};
                    }
                    return {};
                });
            },

            action2: () => {
                set((state: any) => {
                    if (state.curAnimation === state.animationSet.idle) {
                        return {curAnimation: state.animationSet.action2};
                    }
                    return {};
                });
            },

            action3: () => {
                set((state: any) => {
                    if (state.curAnimation === state.animationSet.idle) {
                        return {curAnimation: state.animationSet.action3};
                    }
                    return {};
                });
            },

            action4: () => {
                set((state: any) => {
                    if (
                        state.curAnimation === state.animationSet.idle ||
                        state.curAnimation === state.animationSet.walk ||
                        state.curAnimation === state.animationSet.run
                    ) {
                        return {curAnimation: state.animationSet.action4};
                    }
                    return {};
                });
            },

            /**
             * Additional animations
             */
            // triggerFunction: ()=>{
            //    set((state) => {
            //        return { curAnimation: state.animationSet.additionalAnimation };
            //    });
            // }

            /**
             * Set/get point to move point
             */
            setMoveToPoint: (point: THREE.Vector3) => {
                set(() => {
                    return {moveToPoint: point};
                });
            },

            getMoveToPoint: () => {
                return {
                    moveToPoint: get().moveToPoint,
                };
            },

            /**
             * Set/get camera based movement
             */
            setCameraBased: (isCameraBased: boolean) => {
                set(() => {
                    return {isCameraBased: isCameraBased};
                });
            },

            getCameraBased: () => {
                return {
                    isCameraBased: get().isCameraBased,
                };
            },
        };
    })
);

export type AnimationSet = {
    idle?: string;
    push?: string;
    walk?: string;
    left?: string;
    right?: string;
    run?: string;
    jump?: string;
    jumpIdle?: string;
    jumpLand?: string;
    fall?: string;
    fail: string
    upstairs: string
    recover: string
    climb: string
    jumpDown: string
    levitate: string
    // Currently support four additional animations
    action1?: string;
    action2?: string;
    action3?: string;
    action4?: string;
};

