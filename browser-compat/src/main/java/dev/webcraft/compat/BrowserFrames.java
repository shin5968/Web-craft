package dev.webcraft.compat;
import java.util.*;
/** Explicit application frames maintained by the bytecode port, not guessed from JS stacks. */
public final class BrowserFrames {
    private static final ThreadLocal<ArrayList<Entry>> FRAMES=ThreadLocal.withInitial(ArrayList::new);
    record Entry(Class<?> type,String method,String descriptor,String file,int line){}
    private BrowserFrames(){}
    public static void enter(Class<?> type,String method,String descriptor,String file,int line){FRAMES.get().add(new Entry(type,method,descriptor,file,line));}
    public static void exit(){ArrayList<Entry> frames=FRAMES.get();if(frames.isEmpty())throw new IllegalStateException("Unbalanced browser stack instrumentation");frames.remove(frames.size()-1);}
    static List<Entry> snapshot(){ArrayList<Entry> frames=FRAMES.get();List<Entry> result=new ArrayList<>();for(int i=frames.size()-1;i>=0;i--)result.add(frames.get(i));return result;}
}
