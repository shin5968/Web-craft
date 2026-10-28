package dev.webcraft.compat;
import java.io.Serializable;
import java.util.Arrays;
/** Atomicity through one monitor; no cross-worker shared GC heap is claimed. */
public final class BrowserAtomicLongArray implements Serializable {
    private final long[] values;
    public BrowserAtomicLongArray(int length){if(length<0)throw new NegativeArraySizeException();values=new long[length];}
    public BrowserAtomicLongArray(long[] source){java.util.Objects.requireNonNull(source);values=source.clone();}
    private void checkIndex(int index){if(index<0||index>=values.length)throw new IndexOutOfBoundsException("Atomic array index: "+index);}
    public int length(){return values.length;}
    @SuppressWarnings("unchecked") public synchronized long get(int index){checkIndex(index);return values[index];}
    public synchronized void set(int index,long value){checkIndex(index);values[index]=value;}
    public void lazySet(int index,long value){set(index,value);}
    public synchronized long getAndSet(int index,long value){long old=get(index);values[index]=value;return old;}
    public synchronized boolean compareAndSet(int index,long expected,long update){checkIndex(index);if(values[index]!=expected)return false;values[index]=update;return true;}
    public synchronized long compareAndExchange(int index,long expected,long update){long old=get(index);if(old==expected)values[index]=update;return old;}
    public boolean weakCompareAndSet(int index,long expected,long update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetPlain(int index,long expected,long update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetAcquire(int index,long expected,long update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetRelease(int index,long expected,long update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetVolatile(int index,long expected,long update){return compareAndSet(index,expected,update);}
    public long getPlain(int index){return get(index);}public long getOpaque(int index){return get(index);}public long getAcquire(int index){return get(index);}
    public void setPlain(int index,long value){set(index,value);}public void setOpaque(int index,long value){set(index,value);}public void setRelease(int index,long value){set(index,value);}
    public long compareAndExchangeAcquire(int index,long expected,long update){return compareAndExchange(index,expected,update);}
    public long compareAndExchangeRelease(int index,long expected,long update){return compareAndExchange(index,expected,update);}
    public long getAndUpdate(int index,java.util.function.LongUnaryOperator function){
        long previous=get(index);java.util.Objects.requireNonNull(function);for(;;){long next=function.applyAsLong(previous);if(compareAndSet(index,previous,next))return previous;previous=get(index);}
    }
    public long updateAndGet(int index,java.util.function.LongUnaryOperator function){
        long previous=get(index);java.util.Objects.requireNonNull(function);for(;;){long next=function.applyAsLong(previous);if(compareAndSet(index,previous,next))return next;previous=get(index);}
    }
    public long getAndAccumulate(int index,long value,java.util.function.LongBinaryOperator function){
        long previous=get(index);java.util.Objects.requireNonNull(function);for(;;){long next=function.applyAsLong(previous,value);if(compareAndSet(index,previous,next))return previous;previous=get(index);}
    }
    public long accumulateAndGet(int index,long value,java.util.function.LongBinaryOperator function){
        long previous=get(index);java.util.Objects.requireNonNull(function);for(;;){long next=function.applyAsLong(previous,value);if(compareAndSet(index,previous,next))return next;previous=get(index);}
    }
    public synchronized String toString(){return Arrays.toString(values);}
    public synchronized long getAndAdd(int index,long delta){checkIndex(index);long old=values[index];values[index]=old+delta;return old;}
    public synchronized long addAndGet(int index,long delta){checkIndex(index);values[index]+=delta;return values[index];}
    public long getAndIncrement(int index){return getAndAdd(index,1);}public long getAndDecrement(int index){return getAndAdd(index,-1);}
    public long incrementAndGet(int index){return addAndGet(index,1);}public long decrementAndGet(int index){return addAndGet(index,-1);}
}
