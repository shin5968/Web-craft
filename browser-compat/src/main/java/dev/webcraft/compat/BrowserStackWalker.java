package dev.webcraft.compat;
import java.util.*;
import java.util.function.*;
import java.util.stream.Stream;
/** Logging caller attribution is lowered to a class name at build time. */
public final class BrowserStackWalker {
    public enum Option {RETAIN_CLASS_REFERENCE,SHOW_REFLECT_FRAMES,SHOW_HIDDEN_FRAMES}
    public interface StackFrame {String getClassName();String getMethodName();Class<?> getDeclaringClass();int getByteCodeIndex();String getFileName();int getLineNumber();boolean isNativeMethod();StackTraceElement toStackTraceElement();}
    private BrowserStackWalker(){}
    public static BrowserStackWalker getInstance(){return new BrowserStackWalker();}
    public static BrowserStackWalker getInstance(Option option){Objects.requireNonNull(option);return getInstance();}
    public static BrowserStackWalker getInstance(Set<Option> options){Objects.requireNonNull(options);return getInstance();}
    public static BrowserStackWalker getInstance(Set<Option> options,int depth){if(depth<=0)throw new IllegalArgumentException();return getInstance(options);}
    public Class<?> getCallerClass(){throw new UnsupportedOperationException("Dynamic caller classes require instrumentation; logging calls are lowered at build time");}
    public <T>T walk(Function<? super Stream<StackFrame>,? extends T> function){Objects.requireNonNull(function);throw new UnsupportedOperationException("Full Java stack walking is unavailable in this browser profile");}
    public void forEach(Consumer<? super StackFrame> consumer){Objects.requireNonNull(consumer);throw new UnsupportedOperationException("Full Java stack walking is unavailable in this browser profile");}
}
