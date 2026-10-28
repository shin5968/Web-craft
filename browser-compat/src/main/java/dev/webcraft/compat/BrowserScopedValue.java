package dev.webcraft.compat;

import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.function.Supplier;

/** Dynamic, per-TeaVM-thread bindings. No structured child-thread inheritance. */
public final class BrowserScopedValue<T> {
    private static final ThreadLocal<Frame> CURRENT = new ThreadLocal<>();
    private record Frame(BrowserScopedValue<?> key,Object value,Frame parent) {}
    private BrowserScopedValue() {}
    public static <T> BrowserScopedValue<T> newInstance() { return new BrowserScopedValue<>(); }
    public static <T> Carrier where(BrowserScopedValue<T> key,T value) { return new Carrier(Objects.requireNonNull(key),value,null); }
    private Frame binding() {
        for(Frame frame=CURRENT.get();frame!=null;frame=frame.parent)if(frame.key==this)return frame;
        return null;
    }
    public boolean isBound() { return binding()!=null; }
    @SuppressWarnings("unchecked") public T get() {
        Frame frame=binding();if(frame==null)throw new NoSuchElementException("Unbound scoped value");return (T)frame.value;
    }
    @SuppressWarnings("unchecked") public T orElse(T other) { Frame frame=binding();return frame==null?other:(T)frame.value; }
    @SuppressWarnings("unchecked") public <X extends Throwable> T orElseThrow(Supplier<? extends X> supplier) throws X {
        Objects.requireNonNull(supplier);Frame frame=binding();if(frame==null)throw supplier.get();return (T)frame.value;
    }
    @FunctionalInterface public interface CallableOp<R,X extends Throwable> { R call() throws X; }
    public static final class Carrier {
        private final BrowserScopedValue<?> key;private final Object value;private final Carrier parent;
        private Carrier(BrowserScopedValue<?> key,Object value,Carrier parent){this.key=key;this.value=value;this.parent=parent;}
        public <T> Carrier where(BrowserScopedValue<T> key,T value){return new Carrier(Objects.requireNonNull(key),value,this);}
        private Frame bindings(Frame previous) {
            // Earliest binding is installed first; the most recent duplicate wins.
            Frame result=parent==null?previous:parent.bindings(previous);return new Frame(key,value,result);
        }
        public void run(Runnable operation) {
            Objects.requireNonNull(operation);Frame previous=CURRENT.get();CURRENT.set(bindings(previous));
            try{operation.run();}finally{if(previous==null)CURRENT.remove();else CURRENT.set(previous);}
        }
        public <R,X extends Throwable> R call(CallableOp<? extends R,X> operation) throws X {
            Objects.requireNonNull(operation);Frame previous=CURRENT.get();CURRENT.set(bindings(previous));
            try{return operation.call();}finally{if(previous==null)CURRENT.remove();else CURRENT.set(previous);}
        }
        @SuppressWarnings("unchecked") public <T> T get(BrowserScopedValue<T> requested) {
            Objects.requireNonNull(requested);for(Carrier c=this;c!=null;c=c.parent)if(c.key==requested)return (T)c.value;
            throw new NoSuchElementException("Scoped value not in carrier");
        }
    }
}
