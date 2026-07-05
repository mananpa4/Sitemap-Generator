# Follow these steps for any JS library

> **Actualizado a `yoastseo@3.6.0`** (antes `^1.57.0`). La libreria cambio de
> API entre esas dos versiones: ver la seccion "Cambios al actualizar de
> yoastseo 1.x a 3.x" mas abajo antes de copiar este codigo a otro proyecto.

1. Add this to package.json

        "devDependencies": {
            "cross-env": "^5.1",
            "lodash": "^4.17.5",
            "resolve-url-loader": "^2.3.1",
            "snarkdown": "^1.2.2"
        },
        "dependencies": {
            "yoastseo": "^3.6.0"
        }
 
2. Add file Presenter.js and add this code
 
        import { interpreters } from 'yoastseo'
        import isObject from 'lodash/isObject'
        import forEach from 'lodash/forEach'
        import filter from 'lodash/filter'
     
        export default class Presenter {
     
            getScoresAsHTML(h, data) {
                return h('div', { className: 'yoast' },
                    h('h3', { className: 'yoast__heading' }, 'SEO'),
                    h('ul', { className: 'yoast__items' },
                        this.getScoreItemsAsHTML(h, data.seo)
                    ),
                    h('h3', { className: 'yoast__heading' }, 'Content'),
                    h('ul', { className: 'yoast__items yoast__items--bottom' },
                        this.getScoreItemsAsHTML(h, data.content)
                    )
                )
            }

            getScoreItemsAsHTML(h, items) {
                return items.map(item => this.getScoreItemAsHTML(h, item))
            }

            getScoreItemAsHTML(h, item) {
                return h('li', { className: `yoast__item yoast__item--${item.rating}` }, item.text.replace(/<(?:.|\n)*?>/gm, ''))
            }

            getScores(assessor) {
                const scores = []

                forEach (this.getScoresWithRatings(assessor), (item, key) =>
                    scores.push(this.addRating(item))
                )

                return scores
            }

            addRating(item) {
                return {
                    rating: item.rating,
                    text: item.text,
                    identifier: item.getIdentifier()
                }
            }

            getScoresWithRatings(assessor) {
                const scores = assessor.getValidResults().map(r => {
                    if (!isObject(r) || !r.getIdentifier()) {
                        return ``;
                    }
                    r.rating = interpreters.scoreToRating(r.getScore())
                    return r
                })

                return filter(scores, r => r !== ``);
            }

        }
 
3. All the following steps should be in the same file.
 
     i. Add this import (yoastseo >= 3.x no longer ships a generic `Researcher`
        or needs a `Jed` i18n instance — see the Researcher-per-language note below)
     
        import { Paper, ContentAssessor, SeoAssessor } from "yoastseo";
        import EnglishResearcher from 'yoastseo/build/languageProcessing/languages/en/Researcher';
        import zipObject from 'lodash/zipObject'
        import omit from 'lodash/omit'
        import snarkdown from 'snarkdown';
        import Presenter from 'Presenter';
 
 
    ii. Declare following variable and assign it to form ( Two way binding )
     
        text: '',
        keyword: '',
        title: '',
        description: '',
        url: '',
        titleWidth: '',
        en_locale: 'en_US',
        permalink: '',
        synonyms: '',
        seo: [],
        content: []
 
    iii. Add this function
 
        getScores(seoAssessor, contentAssessor) {
            return {
                seo: new Presenter().getScoresWithRatings(seoAssessor),
                content: new Presenter().getScoresWithRatings(contentAssessor)
            }
        },
        getScoresAsHTML(scores) {
            return new Presenter().getScoresAsHTML(h, scores);
        }
 
    iv. On any action or form submit use this code
 
        const paper = new Paper(this.text, {
                                  keyword: this.keyword,
                                  title: this.title,
                                  description: this.description,
                                  slug: this.url,
                                  titleWidth: this.titleWidth,
                                  locale: this.en_locale,
                                  permalink: this.permalink
                              });
        const researcher = new EnglishResearcher(paper); // pick per this.en_locale, see below
        const contentAssessor = new ContentAssessor(researcher);
        const seoAssessor = new SeoAssessor(researcher);
        contentAssessor.assess(paper);
        seoAssessor.assess(paper);
        const final_scores = this.getScores(seoAssessor, contentAssessor);
        this.seo = final_scores.seo;
        this.content = final_scores.content;
        console.log(this.seo);
        console.log(this.content);

Check console log for Output

## Cambios al actualizar de yoastseo 1.x a 3.x

`yoastseo` salto de la serie `1.x` a `3.x` sin pasar por `2.x`, y cambio la
superficie publica de la API. Lo que este proyecto tuvo que ajustar (ver
`resources/js/components/Presenter.js` y `VueYoastComponent.vue` para el
codigo real, completo):

- **`helpers.scoreToRating` -> `interpreters.scoreToRating`**. La funcion de
  siempre (mapea un score 0-9 a `bad`/`ok`/`good`) se movio de namespace.
- **`r.score` -> `r.getScore()`**. Los resultados de assessment ahora se leen
  con el metodo getter, no accediendo a la propiedad directamente.
- **`SEOAssessor` -> `SeoAssessor`**, y ya **no hace falta un deep-import**
  (`yoastseo/src/seoAssessor`) — ambos, `ContentAssessor` y `SeoAssessor`, se
  exportan directo desde `yoastseo`.
- **No mas `Researcher` generico ni `Jed` para i18n.** Antes se pasaba un
  objeto `Jed` vacio al constructor de los assessors para "traducciones"; eso
  ya no existe. En su lugar, cada idioma tiene su propia clase `Researcher`
  (ver `yoastseo/build/languageProcessing/languages/<lang>/Researcher`), que
  se instancia con el `Paper` y se le pasa a los assessors. Este proyecto
  mapea el `locale` elegido en el formulario (p. ej. `es_ES`) al codigo de 2
  letras (`es`) y usa la clase correspondiente, con `_default` como fallback
  para idiomas sin Researcher dedicado — algo que la integracion original
  con `1.57.0` no hacia (siempre corria el analisis en modo generico,
  independientemente del locale elegido).
- **`url` esta deprecado a favor de `slug`** en las opciones de `Paper`; se
  actualizo el codigo para pasar `slug` en vez de `url` (el campo del
  formulario se mantiene igual, solo cambio a que atributo del `Paper` se
  mapea).
- Idiomas con Researcher dedicado en esta version: ar, ca, cs, de, el, en,
  es, fa, fr, he, hu, id, it, ja, nb (noruego bokmal), nl, pl, pt, ru, sk, sv,
  tr. Cualquier otro locale usa `_default` (solo assessments que no
  dependen de reglas linguisticas especificas).

# Laravel-YoastSeo

This is Complete Laravel YoastSeo package using built in Vue Component.

After months of reasearch and figured out that there is no package built for laravel.

No good documentation of YoastSeoJS in their own repo of how to use their internal components.

So this is Vue-Component which can be used in any existing Laravel Project or in Vue Project (SPAs).

Steps to use:
 1. Use Virtual host or serve your Laravel project.
 2. Install Node and then use npm install and run npm run prod.
 3. Open the Project homepage mainly Laravel Welcome Page (ie., http://larevel-yoast-vue/  OR localhost:8080/ ) which you should see a yoast form.
 
 
 
# Special thanks to:

 1. mr-cms-yoast https://git.mreach.com/mr-cms/mr-cms-yoast
 2. netlify-cms-yoast-seo https://github.com/indigotree/netlify-cms-yoast-seo 

    thier code helped me to understand and build YoastSEO for laravel using VueJS
