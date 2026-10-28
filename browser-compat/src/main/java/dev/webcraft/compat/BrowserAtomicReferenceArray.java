package dev.webcraft.compat;
import java.io.Serializable;
import java.util.Arrays;
/** Atomicity through one monitor; no cross-worker shared GC heap is claimed. */
public final class BrowserAtomicReferenceArray<E> implements Serializable {
    private final Object[] values;
    public BrowserAtomicReferenceArray(int length){values=new Object[length];}
    public BrowserAtomicReferenceArray(E[] source){values=Arrays.copyOf(source,source.length,Object[].class);}
    public int length(){return values.length;}
    @SuppressWarnings("unchecked") public synchronized E get(int index){return (E)values[index];}
    public synchronized void set(int index,E value){values[index]=value;}
    public void lazySet(int index,E value){set(index,value);}
    public synchronized E getAndSet(int index,E value){E old=get(index);values[index]=value;return old;}
    public synchronized boolean compareAndSet(int index,E expected,E update){if(values[index]!=expected)return false;values[index]=update;return true;}
    public synchronized E compareAndExchange(int index,E expected,E update){E old=get(index);if(old==expected)values[index]=update;return old;}
    public boolean weakCompareAndSet(int index,E expected,E update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetPlain(int index,E expected,E update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetAcquire(int index,E expected,E update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetRelease(int index,E expected,E update){return compareAndSet(index,expected,update);}
    public boolean weakCompareAndSetVolatile(int index,E expected,E update){return compareAndSet(index,expected,update);}
    public E getPlain(int index){return get(index);}public E getOpaque(int index){return get(index);}public E getAcquire(int index){return get(index);}
    public void setPlain(int index,E value){set(index,value);}public void setOpaque(int index,E value){set(index,value);}public void setRelease(int index,E value){set(index,value);}
    public E compareAndExchangeAcquire(int index,E expected,E update){return compareAndExchange(index,expected,update);}
    public E compareAndExchangeRelease(int index,E expected,E update){return compareAndExchange(index,expected,update);}
    public E getAndUpdate(int index,java.util.function.UnaryOperator<E> function){
        E previous=get(index);for(;;){E next=function.apply(previous);if(compareAndSet(index,previous,next))return previous;previous=get(index);}
    }
    public E updateAndGet(int index,java.util.function.UnaryOperator<E> function){
        E previous=get(index);for(;;){E next=function.apply(previous);if(compareAndSet(index,previous,next))return next;previous=get(index);}
    }
    public E getAndAccumulate(int index,E value,java.util.function.BinaryOperator<E> function){
        E previous=get(index);for(;;){E next=function.apply(previous,value);if(compareAndSet(index,previous,next))return previous;previous=get(index);}
    }
    public E accumulateAndGet(int index,E value,java.util.function.BinaryOperator<E> function){
        E previous=get(index);for(;;){E next=function.apply(previous,value);if(compareAndSet(index,previous,next))return next;previous=get(index);}
    }
    public synchronized String toString(){return Arrays.toString(values);}
}
