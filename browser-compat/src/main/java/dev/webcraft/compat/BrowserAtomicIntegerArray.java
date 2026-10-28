package dev.webcraft.compat;
import java.io.Serializable;
import java.util.Arrays;
/** Atomicity through one monitor; no cross-worker shared GC heap is claimed. */
public final class BrowserAtomicIntegerArray implements Serializable {
    private final int[] values;
    public BrowserAtomicIntegerArray(int length){values=new int[length];}
    public BrowserAtomicIntegerArray(int[] source){values=source.clone();}
    public int length(){return values.length;}
    @SuppressWarnings("unchecked") public synchronized int get(int index){return values[index];}
    public synchronized void set(int index,int value){values[index]=value;}
    public void lazySet(int index,int value){set(index,value);}
    public synchronized int getAndSet(int index,int value){int old=get(index);values[index]=value;return old;}
    public synchronized boolean compareAndSet(int index,int expected,int update){if(values[index]!=expected)return false;values[index]=update;return true;}
    public synchronized int compareAndExchange(int index,int expected,int update){int old=get(index);if(old==expected)values[index]=update;return old;}
    public boolean weakCompareAndSet(int index,int expected,int update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetPlain(int index,int expected,int update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetAcquire(int index,int expected,int update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetRelease(int index,int expected,int update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetVolatile(int index,int expected,int update){return compareAndSet(index,expected,update);}
    public int getPlain(int index){return get(index);}public int getOpaque(int index){return get(index);}public int getAcquire(int index){return get(index);}
    public void setPlain(int index,int value){set(index,value);}public void setOpaque(int index,int value){set(index,value);}public void setRelease(int index,int value){set(index,value);}
    public int compareAndExchangeAcquire(int index,int expected,int update){return compareAndExchange(index,expected,update);}
    public int compareAndExchangeRelease(int index,int expected,int update){return compareAndExchange(index,expected,update);}
    public int getAndUpdate(int index,java.util.function.IntUnaryOperator function){
        int previous=get(index);for(;;){int next=function.applyAsInt(previous);if(compareAndSet(index,previous,next))return previous;previous=get(index);}
    }
    public int updateAndGet(int index,java.util.function.IntUnaryOperator function){
        int previous=get(index);for(;;){int next=function.applyAsInt(previous);if(compareAndSet(index,previous,next))return next;previous=get(index);}
    }
    public int getAndAccumulate(int index,int value,java.util.function.IntBinaryOperator function){
        int previous=get(index);for(;;){int next=function.applyAsInt(previous,value);if(compareAndSet(index,previous,next))return previous;previous=get(index);}
    }
    public int accumulateAndGet(int index,int value,java.util.function.IntBinaryOperator function){
        int previous=get(index);for(;;){int next=function.applyAsInt(previous,value);if(compareAndSet(index,previous,next))return next;previous=get(index);}
    }
    public synchronized String toString(){return Arrays.toString(values);}
    public synchronized int getAndAdd(int index,int delta){int old=values[index];values[index]=old+delta;return old;}
    public synchronized int addAndGet(int index,int delta){values[index]+=delta;return values[index];}
    public int getAndIncrement(int index){return getAndAdd(index,1);}public int getAndDecrement(int index){return getAndAdd(index,-1);}
    public int incrementAndGet(int index){return addAndGet(index,1);}public int decrementAndGet(int index){return addAndGet(index,-1);}
}
