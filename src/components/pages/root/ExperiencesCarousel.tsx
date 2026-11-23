"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { FaUsers } from "react-icons/fa";
import { MdOutlineExplore } from "react-icons/md";
import styles from "./ExperiencesCarousel.module.css";

const experiences = [
  {
    title: "Aventura na lama",
    description: "Quando o caminho fica difícil, a diversão está só começando.",
    image: "/images/experiencia-lama.jpg",
    alt: "Jipes verde e amarelo atravessam um trecho de lama",
    Icon: MdOutlineExplore,
  },
  {
    title: "Juntos para a próxima trilha",
    description: "Jipes alinhados, motores prontos e muita história pela frente.",
    image: "/images/experiencia-encontro.jpg",
    alt: "Fileira de jipes preparados para um encontro off-road",
    Icon: FaUsers,
  },
  {
    title: "Diversão sem frescura",
    description: "Entre risadas e lama, cada encontro vira uma boa lembrança.",
    image: "/images/experiencia-diversao.jpg",
    alt: "Grupo se diverte correndo em uma área de lama",
    Icon: FaUsers,
  },
  {
    title: "Aventura que aproxima",
    description: "Na trilha e fora dela, o melhor é compartilhar bons momentos.",
    image: "/images/experiencia-comunidade.jpg",
    alt: "Integrantes do clube preparam comida sob uma tenda",
    Icon: FaUsers,
  },
  {
    title: "Caminhos da serra",
    description: "Terra vermelha, montanhas ao redor e mais um caminho para explorar.",
    image: "/images/experiencia-serra.jpg",
    alt: "Jipes seguem por uma estrada de terra entre morros verdes",
    Icon: MdOutlineExplore,
  },
  {
    title: "Amizade em cada parada",
    description: "Boas companhias fazem qualquer passeio valer ainda mais.",
    image: "/images/experiencia-amizade.jpg",
    alt: "Grupo de amigos posa para uma foto ao lado dos jipes no campo",
    Icon: FaUsers,
  },
  {
    title: "Parceiros de verdade",
    description: "Na hora do desafio, sempre tem alguém pronto para ajudar.",
    image: "/images/experiencia-parceria.jpg",
    alt: "Integrantes ajudam a verificar o motor de um jipe",
    Icon: FaUsers,
  },
  {
    title: "Trilha, chuva e superação",
    description: "A chuva muda o terreno; a vontade de seguir continua a mesma.",
    image: "/images/experiencia-trilha.jpg",
    alt: "Jipes enfrentam uma trilha enlameada cercada por mata",
    Icon: MdOutlineExplore,
  },
];

// Cópias nas extremidades permitem continuar o movimento sem voltar a faixa.
const slides = [...experiences, ...experiences, ...experiences];

export default function ExperiencesCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function shift(distance: number) {
    const track = trackRef.current;
    const animation = track?.getAnimations()[0];
    const first = track?.children[0];
    const nextCycle = track?.children[experiences.length];
    if (!animation || !first || !nextCycle) return;
    const cycleWidth = nextCycle.getBoundingClientRect().left - first.getBoundingClientRect().left;
    const duration = Number(animation.effect?.getComputedTiming().duration);
    if (!cycleWidth || !duration || typeof animation.currentTime !== "number") return;
    animation.currentTime = ((animation.currentTime - distance * duration / cycleWidth) % duration + duration) % duration;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || !trackRef.current?.getAnimations().length) return;
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > Math.abs(event.clientY - start.y)) shift(dx);
    gesture.current = { ...start, x: event.clientX, y: event.clientY };
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!trackRef.current?.getAnimations().length) return;
    event.preventDefault();
    shift(event.key === "ArrowRight" ? -event.currentTarget.clientWidth * 0.5 : event.currentTarget.clientWidth * 0.5);
  }

  return (
    <div
      role="region"
      aria-roledescription="carrossel"
      aria-label="Nossas experiências"
    >
      <div
        id="experiencias-slides"
        className={`${styles.viewport} ${styles.experiences}`}
        style={{ "--experience-count": experiences.length } as CSSProperties}
        tabIndex={0}
        aria-label="Arraste ou use as setas do teclado para navegar pelas experiências."
        data-dragging={dragging}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onKeyDown={handleKeyDown}
      >
        <div ref={trackRef} className={styles.track}>
        {slides.map(({ title, description, image, alt, Icon }, index) => (
          <article
            key={`${title}-${index}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index % experiences.length + 1} de ${experiences.length}`}
            aria-hidden={index < experiences.length || index >= experiences.length * 2}
            inert={index < experiences.length || index >= experiences.length * 2}
            className={styles.card}
            data-clone={index < experiences.length || index >= experiences.length * 2}
          >
            <Image src={image} alt={alt} fill sizes="(max-width: 767px) 74vw, (max-width: 800px) 80vw, 640px" className="pointer-events-none object-cover" draggable={false} />
            <div className={styles.shade} />
            <div className={styles.content}>
              <div className={styles.title}>
                <Icon size={24} className="shrink-0 text-yellow-400" aria-hidden="true" />
                <h3 className="text-xl font-bold md:text-2xl">{title}</h3>
              </div>
              <p className={styles.description}>{description}</p>
            </div>
          </article>
        ))}
        </div>
      </div>

    </div>
  );
}
