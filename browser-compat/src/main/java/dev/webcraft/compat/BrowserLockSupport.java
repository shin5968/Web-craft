package dev.webcraft.compat;
import java.util.*;

/** Permit protocol for the non-blocking bootstrap profile, not a parking scheduler. */
public final class BrowserLockSupport {
    private static final Map<Thread,State> STATES=new WeakHashMap<>();
    private static final class State {boolean permit;Object blocker;}
    private BrowserLockSupport(){}
    private static State state(Thread thread){Objects.requireNonNull(thread);synchronized(STATES){return STATES.computeIfAbsent(thread,key->new State());}}
    public static void unpark(Thread thread){if(thread==null)return;State state=state(thread);synchronized(state){state.permit=true;}}
    private static boolean immediate(){Thread thread=Thread.currentThread();if(thread.isInterrupted())return true;
        State state=state(thread);synchronized(state){if(!state.permit)return false;state.permit=false;return true;}}
    public static void park(){park(null);}
    public static void park(Object blocker){if(!immediate())throw new UnsupportedOperationException("Parking requires a thread scheduler; no permit is available");}
    public static void parkNanos(long nanos){parkNanos(null,nanos);}
    public static void parkNanos(Object blocker,long nanos){if(nanos<=0)return;if(!immediate())throw new UnsupportedOperationException("Timed parking requires a thread scheduler");}
    public static void parkUntil(long deadline){parkUntil(null,deadline);}
    public static void parkUntil(Object blocker,long deadline){if(immediate()||deadline<=System.currentTimeMillis())return;throw new UnsupportedOperationException("Deadline parking requires a thread scheduler");}
    public static Object getBlocker(Thread thread){State state=state(thread);synchronized(state){return state.blocker;}}
    public static void setCurrentBlocker(Object blocker){State state=state(Thread.currentThread());synchronized(state){state.blocker=blocker;}}
}
