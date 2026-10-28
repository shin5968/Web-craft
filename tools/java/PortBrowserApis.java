import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import org.objectweb.asm.*;
import org.objectweb.asm.commons.*;

/** Remap a deliberately limited browser execution profile, never java.* definitions. */
public final class PortBrowserApis implements Opcodes {
    static final String PREFIX="dev/webcraft/compat/";
    static final Map<String,String> TYPES=new LinkedHashMap<>();
    static {
        TYPES.put("java/lang/ScopedValue",PREFIX+"BrowserScopedValue");
        TYPES.put("java/lang/ScopedValue$Carrier",PREFIX+"BrowserScopedValue$Carrier");
        TYPES.put("java/lang/ScopedValue$CallableOp",PREFIX+"BrowserScopedValue$CallableOp");
        TYPES.put("java/lang/StackWalker",PREFIX+"BrowserStackWalker");
        TYPES.put("java/lang/StackWalker$Option",PREFIX+"BrowserStackWalker$Option");
        TYPES.put("java/lang/StackWalker$StackFrame",PREFIX+"BrowserStackWalker$StackFrame");
        TYPES.put("java/util/concurrent/locks/Lock",PREFIX+"BrowserLock");
        TYPES.put("java/util/concurrent/locks/Condition",PREFIX+"BrowserCondition");
        TYPES.put("java/util/concurrent/locks/ReentrantLock",PREFIX+"BrowserReentrantLock");
        TYPES.put("java/util/concurrent/locks/ReadWriteLock",PREFIX+"BrowserReadWriteLock");
        TYPES.put("java/util/concurrent/locks/ReentrantReadWriteLock",PREFIX+"BrowserReentrantReadWriteLock");
        TYPES.put("java/util/concurrent/locks/ReentrantReadWriteLock$ReadLock",PREFIX+"BrowserReentrantReadWriteLock$ReadLock");
        TYPES.put("java/util/concurrent/locks/ReentrantReadWriteLock$WriteLock",PREFIX+"BrowserReentrantReadWriteLock$WriteLock");
    }
    static final Map<String,Integer> COUNTS=new TreeMap<>();
    static void count(String key){COUNTS.merge(key,1,Integer::sum);}
    static Remapper remapper=new Remapper(ASM9){public String map(String name){String mapped=TYPES.get(name);if(mapped!=null){count(name);return mapped;}return name;}};
    static String resourceDescriptor(String owner,String name,String desc,int opcode) {
        if(owner.equals("java/lang/ClassLoader")) {
            if(Set.of("getResource","getResources","getResourceAsStream","loadClass").contains(name)
                    && desc.startsWith("(Ljava/lang/String;)") && opcode!=INVOKESTATIC)
                return "(Ljava/lang/ClassLoader;"+desc.substring(1);
            if(Set.of("getSystemResource","getSystemResources","getSystemResourceAsStream").contains(name)
                    && desc.startsWith("(Ljava/lang/String;)") && opcode==INVOKESTATIC)return desc;
        }
        if(owner.equals("java/lang/Class")&&Set.of("getResource","getResourceAsStream").contains(name)
                && desc.startsWith("(Ljava/lang/String;)")&&opcode!=INVOKESTATIC)return "(Ljava/lang/Class;"+desc.substring(1);
        return null;
    }
    static byte[] transform(byte[] input) {
        ClassReader reader=new ClassReader(input);
        // Runtime implementation must not recursively remap its own loader bridge.
        if(reader.getClassName().startsWith(PREFIX))return input;
        ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
        ClassVisitor mapped=new ClassRemapper(writer,remapper);
        ClassVisitor bridge=new ClassVisitor(ASM9,mapped){
            String className;
            public void visit(int v,int a,String n,String s,String p,String[] i){className=n;super.visit(v,a,n,s,p,i);}
            public MethodVisitor visitMethod(int access,String name,String descriptor,String signature,String[] exceptions){
                MethodVisitor destination=super.visitMethod(access,name,descriptor,signature,exceptions);
                return new MethodVisitor(ASM9,destination){
                    public void visitCode(){super.visitCode();
                        if(name.equals("main")&&descriptor.equals("([Ljava/lang/String;)V")&&
                                (className.equals("dev/webcraft/browser/RegistryBootstrap")||className.equals("dev/webcraft/test/ApiSemanticsCheck"))) {
                            super.visitMethodInsn(INVOKESTATIC,PREFIX+"EmbeddedResources","install","()V",false);
                        }
                    }
                    public void visitMethodInsn(int opcode,String owner,String called,String desc,boolean itf){
                        if(owner.equals("com/mojang/logging/LogUtils")&&called.equals("getLogger")&&desc.equals("()Lorg/slf4j/Logger;")){
                            super.visitLdcInsn(className.replace('/','.'));
                            super.visitMethodInsn(INVOKESTATIC,"org/slf4j/LoggerFactory","getLogger","(Ljava/lang/String;)Lorg/slf4j/Logger;",false);
                            count("static-logger-caller");return;
                        }
                        String replacement=resourceDescriptor(owner,called,desc,opcode);
                        if(replacement!=null){super.visitMethodInsn(INVOKESTATIC,PREFIX+"BrowserResources",called,replacement,false);count("resource-"+called);return;}
                        super.visitMethodInsn(opcode,owner,called,desc,itf);
                    }
                };
            }
        };
        reader.accept(bridge,0);return writer.toByteArray();
    }
    public static void main(String[] args) throws Exception {
        try(JarFile source=new JarFile(args[0]);JarOutputStream output=new JarOutputStream(Files.newOutputStream(Path.of(args[1])))){
            for(var entries=source.entries();entries.hasMoreElements();){JarEntry entry=entries.nextElement();String name=entry.getName(),upper=name.toUpperCase(Locale.ROOT);
                if(name.equals("module-info.class")||name.endsWith("/module-info.class")||upper.startsWith("META-INF/")&&(upper.endsWith(".SF")||upper.endsWith(".RSA")||upper.endsWith(".DSA")))continue;
                byte[] bytes=source.getInputStream(entry).readAllBytes();
                if(name.endsWith(".class"))bytes=transform(bytes);
                output.putNextEntry(new JarEntry(name));output.write(bytes);output.closeEntry();
            }
        }
        System.out.println("API_PORT "+COUNTS);
    }
}
